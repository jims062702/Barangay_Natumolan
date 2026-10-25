<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\RecordHearingOutcomeRequest;
use App\Http\Requests\Lupon\RecordSummonsRequest;
use App\Http\Requests\Lupon\ScheduleHearingRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Services\Lupon\FilingFeeDeadlines;
use App\Services\Lupon\HearingCalendar;
use App\Services\Lupon\HearingDesk;
use App\Services\Lupon\HearingNotice;
use App\Services\Lupon\HearingSession;
use App\Services\Lupon\PartyNotice;
use App\Support\ManilaTime;
use Illuminate\Validation\Rule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Hearings: set on a case, and worked from the desk-wide calendar —
 * summons and proof of service, attendance and outcome, and resetting a date.
 *
 * THREE OFFICES READ THIS CALENDAR AND ONE OF THEM MAY WRITE TO EACH ROW.
 * The Barangay Secretary keeps the record of the Punong Barangay's Tuesdays;
 * the Lupon works its own Thursdays; the Punong Barangay writes nothing at
 * all — they preside, and a second officer able to enter the same minutes is
 * how a docket comes to hold two answers. `refuseWrongDesk` is that rule, and
 * every method that CHANGES a sitting goes through it. `index` and `show` do
 * not: knowing when the hall sits is not the same as being able to move it.
 */
class HearingController extends BaseController
{
    /**
     * MARK WHAT IS RUNNING LATE. MOVE NOTHING.
     *
     * A hearing may run past its ninety minutes — the parties are in the
     * room and the dispute takes what it takes — and when it does, the
     * sitting after it starts late. The appointment is NOT rewritten: the
     * summons in a party's hand names an hour, and a system that quietly
     * shifted it would be telling them one thing and the hall another.
     *
     * So the row carries how far behind it is, and the office reads the day
     * as it actually stands while every appointment survives intact.
     *
     * @param  iterable<Hearing>  $sittings
     */
    private function markDelays(iterable $sittings): void
    {
        /* One query for every day on the page, rather than one per row. */
        $days = collect($sittings)
            ->filter(fn (Hearing $h) => $h->scheduled_at !== null)
            ->map(fn (Hearing $h) => $h->scheduled_at->toDateString())
            ->unique();

        $ran = $days->isEmpty() ? collect() : Hearing::query()
            ->whereNotNull('ended_at')
            ->whereIn(DB::raw('DATE(scheduled_at)'), $days->values()->all())
            ->get(['id', 'hearing_type', 'scheduled_at', 'ended_at']);

        foreach ($sittings as $sitting) {
            $behind = 0;

            if ($sitting->scheduled_at) {
                foreach ($ran as $earlier) {
                    if (
                        $earlier->id === $sitting->id
                        || $earlier->hearing_type !== $sitting->hearing_type
                        || $earlier->scheduled_at >= $sitting->scheduled_at
                        || $earlier->ended_at <= $sitting->scheduled_at
                    ) {
                        continue;
                    }

                    $behind = max($behind, $sitting->scheduled_at->diffInMinutes($earlier->ended_at));
                }
            }

            $sitting->setAttribute('delayed_minutes', $behind);
        }
    }

    /** Not your desk — said in the words of whoever's desk it is. */
    private function refuseWrongDesk(Hearing $hearing)
    {
        $desk = HearingDesk::forType((string) $hearing->hearing_type);

        return HearingDesk::may(auth()->user(), $desk)
            ? null
            : $this->error(HearingDesk::refusal($desk), 403);
    }

    /** 3.4 — the hearing calendar across the whole docket. */
    public function index(Request $request)
    {
        $query = Hearing::with(array_merge(CaseFile::WITH_PARTIES, [
            'recorder:id,name',
            'luponCase.hearings' => fn ($q) => $q->orderBy('scheduled_at', 'asc'),
        ]))->whereHas('luponCase', function ($q) {
            $q->whereNotIn('current_stage', ['Filed', 'For Summons']);
        });

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('hearing_type')) {
            $query->where('hearing_type', $request->hearing_type);
        }

        /*
         * THE PUNONG BARANGAY SEES TUESDAYS, AND ONLY TUESDAYS.
         *
         * Their menu offers the calendar alone, but a menu is not a boundary
         * — these list addresses are still typed, bookmarked and shared, and
         * they showed every sitting on the docket including the Lupon's own
         * Thursdays. The Lupon's conciliation is not the Punong Barangay's
         * to read: the case left them when their three sittings were spent.
         */
        /*
         * DESK BOUNDARY:
         * Secretary and Punong Barangay work PB Mediation (Tuesdays).
         * Lupon works Conciliation (Thursdays).
         */
        if (! $request->filled('hearing_type')) {
            $role = $request->user()?->role;
            $userOffice = $request->user()?->office;

            if (in_array($role, ['Punong Barangay', 'Secretary'], true) || ($userOffice === 'Main Office' && $role !== 'Admin')) {
                $query->where('hearing_type', 'Mediation');
            } elseif ($userOffice === 'Lupon' || $role === 'Lupon Secretary') {
                $query->where('hearing_type', 'Conciliation');
            }
        }

        /*
         * Buckets are whole DAYS, not the current instant. Comparing against
         * now() moved a 9am hearing into "past" by 9:01, so the day's own
         * hearings vanished from the desk while they were still being held.
         *
         * AND THE DAY IS MANILA'S. `app.timezone` is UTC, so Laravel's
         * today() is eight hours behind the hall: every morning between
         * midnight and 8am the barangay's clerks opened "Today's Hearing"
         * and were shown YESTERDAY'S sittings, with the day's own three
         * filed under Upcoming. The hearings are stored as Manila wall
         * clock, so the day they are bucketed by has to be Manila's too.
         */
        $day = ManilaTime::today();

        if ($request->filled('when')) {
            match ($request->when) {
                'today' => $query->whereDate('scheduled_at', $day)->orderBy('scheduled_at', 'asc')->orderBy('lupon_case_id', 'asc'),
                'upcoming' => $query->whereDate('scheduled_at', '>', $day)
                    ->whereRaw('id = (
                        SELECT h2.id FROM lupon_hearings h2
                        WHERE h2.lupon_case_id = lupon_hearings.lupon_case_id
                          AND DATE(h2.scheduled_at) > ?
                        ORDER BY (CASE WHEN h2.status = \'Cancelled\' THEN 1 ELSE 0 END) ASC, h2.scheduled_at ASC, h2.id ASC
                        LIMIT 1
                    )', [$day])
                    ->orderBy('scheduled_at', 'asc')
                    ->orderBy('lupon_case_id', 'asc'),
                'past' => $query->where(function ($q) use ($day) {
                    $q->whereDate('scheduled_at', '<', $day)
                      ->orWhere('status', 'Completed');
                })->orderBy('scheduled_at', 'asc')->orderBy('lupon_case_id', 'asc'),
                default => $query->orderBy('scheduled_at', 'asc')->orderBy('lupon_case_id', 'asc'),
            };
        } else {
            $query->orderBy('scheduled_at', 'asc')->orderBy('lupon_case_id', 'asc');
        }

        // Hearings set but with no summons served yet — the service backlog.
        if ($request->boolean('unserved')) {
            $query->where('status', 'Scheduled')->whereNull('summons_served_date');
        }

        $page = $query->paginate(20);
        $this->markDelays($page->getCollection());

        return $this->success($page, 'Hearings retrieved');
    }

    /**
     * The two lists the hearing room keeps beside the calendar: cases that
     * ended without a sitting to hold, and cases certified to court.
     *
     * Cases, not hearings — and here rather than on the docket because the
     * Barangay Secretary works this screen and has no access to the docket.
     * Only what the room needs: the parties, when it ended and why.
     */
    public function closedCases(Request $request)
    {
        $validated = $request->validate([
            'state' => ['required', Rule::in(['cancelled', 'cfa'])],
        ]);

        $stages = $validated['state'] === 'cfa' ? ['CFA'] : ['Withdrawn'];

        $casesQuery = CaseFile::with(['complainant:id,first_name,middle_name,last_name', 'respondents:id,first_name,middle_name,last_name'])
            ->whereIn('current_stage', $stages);

        $role = $request->user()?->role;
        $userOffice = $request->user()?->office;
        $isSecretary = in_array($role, ['Punong Barangay', 'Secretary'], true) || ($userOffice === 'Main Office' && $role !== 'Admin');
        $isLupon = $userOffice === 'Lupon' || $role === 'Lupon Secretary';

        if ($isSecretary) {
            $casesQuery->whereDoesntHave('hearings', fn ($q) => $q->where('hearing_type', 'Conciliation'));
        } elseif ($isLupon) {
            $casesQuery->whereHas('hearings', fn ($q) => $q->where('hearing_type', 'Conciliation'));
        }

        $cases = $casesQuery
            ->orderByDesc('date_resolved')
            ->orderByDesc('id')
            ->paginate(20);

        return $this->success($cases, 'Cases retrieved');
    }

    /**
     * A MONTH OF THE PUNONG BARANGAY'S SITTINGS, for a calendar.
     *
     * The Punong Barangay presides and records nothing, so a paginated list
     * of twenty rows with an Actions column is the wrong shape for them
     * entirely: what they need is the month laid out — which days the hall
     * sits, how many are booked on each, at what hour, and who is coming.
     * The Lupon reads the same screen, because a case on its third Tuesday
     * is a case about to land on their desk.
     *
     * Mediation only: these are the Punong Barangay's own Tuesdays. The
     * Lupon's Thursdays are their own work and sit on their own lists.
     *
     * Not paginated — a month is the page.
     */
    public function calendar(Request $request)
    {
        $month = $request->filled('month') && preg_match('/^\d{4}-\d{2}$/', (string) $request->month)
            ? $request->month
            : substr(ManilaTime::today(), 0, 7);

        $type = $request->get('hearing_type');
        if (! $type) {
            $type = ($request->user()?->office === 'Lupon' && $request->user()?->role !== 'Punong Barangay')
                ? 'Conciliation'
                : 'Mediation';
        }

        $sittings = Hearing::with(CaseFile::WITH_PARTIES)
            ->where('hearing_type', $type)
            ->whereHas('luponCase', function ($q) {
                $q->whereNotIn('current_stage', ['Filed', 'For Summons']);
            })
            ->whereRaw("DATE_FORMAT(scheduled_at, '%Y-%m') = ?", [$month])
            ->orderBy('scheduled_at')
            ->get();

        $lastOfCase = Hearing::where('hearing_type', $type)
            ->whereIn('lupon_case_id', $sittings->pluck('lupon_case_id')->filter()->unique())
            ->whereIn('status', ['Scheduled', 'Completed'])
            ->selectRaw('lupon_case_id, MAX(scheduled_at) AS last_at')
            ->groupBy('lupon_case_id')
            ->pluck('last_at', 'lupon_case_id');

        foreach ($sittings as $sitting) {
            $sitting->setAttribute('result_label', $this->resultLabel($sitting, $lastOfCase));
        }

        $this->markDelays($sittings);

        $calendarService = app(\App\Services\Lupon\HearingCalendar::class);
        $capacities = $calendarService->monthCapacities($month, $type);

        return $this->success([
            'month' => $month,
            /* Manila's today, so the calendar highlights the day the hall
               is actually in — app.timezone is UTC and eight hours behind. */
            'today' => ManilaTime::today(),
            'capacities' => $capacities,
            'hearings' => $sittings,
        ], 'Hearing calendar retrieved');
    }

    /**
     * One sitting's outcome, as the calendar says it.
     *
     *   Completed · Settled        the parties agreed and the case closed
     *   Completed · Move to Lupon  the last of the three, spent without
     *                              agreement, so the case left the Punong
     *                              Barangay
     *   Completed · Not settled    nothing agreed, and another sitting stands
     *
     * A sitting still ahead has no result, and says nothing.
     */
    private function resultLabel(Hearing $hearing, $lastOfCase): ?string
    {
        if ($hearing->status !== 'Completed') {
            return $hearing->status === 'Scheduled' ? null : $hearing->status;
        }

        if ($hearing->outcome === 'Agreement') {
            return 'Completed · Settled';
        }

        $last = $lastOfCase[$hearing->lupon_case_id] ?? null;

        /* The last Tuesday of the three, spent: the case moves on. */
        $wasLast = $last && $hearing->scheduled_at
            && $hearing->scheduled_at->toDateTimeString() === (string) $last;

        return $wasLast ? 'Completed · Move to Lupon' : 'Completed · Not settled';
    }

    /**
     * THE CASE ITSELF, READ-ONLY, FOR THE OFFICER WHO WRITES IT UP.
     *
     * The Barangay Secretary keeps the minutes of the Punong Barangay's
     * sittings and has no access to the docket — which left them writing an
     * account of a dispute they could not read. The case number on every
     * row linked to the docket and answered 403 to the one officer whose job
     * it is to record what happened.
     *
     * This is the case as the hearing room needs it: the complaint, the
     * parties, the sittings and the settlement, and nothing that could
     * change any of them. The docket — filing, the fee, the certificate —
     * stays with the Lupon.
     */
    public function caseFile(CaseFile $case)
    {
        $case->load([
            'complaint',
            'complainant:id,first_name,middle_name,last_name,contact_number',
            'respondents:id,first_name,middle_name,last_name,contact_number',
            'settlement',
            'hearings' => fn ($q) => $q->orderBy('scheduled_at'),
            'hearings.recorder:id,name',
        ]);

        return $this->success($case, 'Case retrieved');
    }

    /**
     * One sitting, for the screen the minutes are taken on.
     *
     * The complaint comes with it. The Secretary writing the minutes needs
     * what the case is ABOUT in front of them — asking them to open the
     * docket for it is asking them to leave the room mid-sitting, and the
     * docket is a screen this officer does not have.
     */
    public function show(Hearing $hearing)
    {
        $hearing->load(array_merge(CaseFile::WITH_PARTIES, ['recorder:id,name']));
        $hearing->luponCase?->load('complaint');

        /*
         * Whether this is the LAST of the three sittings of its kind.
         *
         * The screen has to say what recording it will do, and on the third
         * Tuesday that is not "the case stays where it is" — it is "the case
         * goes to the Lupon". Worked out here because the hearing is sent
         * without its siblings, and a page that cannot count them would have
         * to guess.
         */
        $hearing->setAttribute('last_of_stage', ! $hearing->luponCase?->hearings()
            ->where('hearing_type', $hearing->hearing_type)
            ->where('status', 'Scheduled')
            ->where('id', '!=', $hearing->id)
            ->exists());

        return $this->success($hearing, 'Hearing retrieved');
    }

    public function store(ScheduleHearingRequest $request, CaseFile $case, HearingNotice $notice)
    {
        $validated = $request->validated();

        /* A closed case sits no more; a case still waiting on its filing
           fee does not go on to a sitting until the fee is paid. */
        if ($case->isClosed()) {
            return $this->error('This case is closed; nothing more is scheduled on it.', 422);
        }
        if ($case->current_stage === 'Filed' && ! $case->filing_fee_paid) {
            return $this->error('The filing fee has not been paid yet, so no sitting can be scheduled.', 422);
        }

        $hearing = $case->hearings()->create($validated + ['recorded_by' => auth()->id()]);

        if ($case->current_stage === 'Filed' && $validated['hearing_type'] === 'Mediation') {
            $case->update(['current_stage' => 'Mediation']);
        }

        $notice->toParties(
            $case,
            'KP Hearing Scheduled — ' . $case->case_number,
            sprintf('A %s hearing is scheduled on %s at the Barangay Hall. Attendance is required.',
                strtolower($validated['hearing_type']),
                date('F j, Y g:i A', strtotime($validated['scheduled_at'])))
        );

        return $this->success($hearing, 'Hearing scheduled', 201);
    }

    /** 3.4 — record attendance and the outcome straight from the calendar. */
    public function update(RecordHearingOutcomeRequest $request, Hearing $hearing)
    {
        if ($refusal = $this->refuseWrongDesk($hearing)) {
            return $refusal;
        }

        $validated = $request->validated();

        $hearing->update($validated + ['recorded_by' => auth()->id()]);
        $hearing->load(CaseFile::WITH_PARTIES);

        return $this->success($hearing, 'Hearing outcome recorded');
    }

    public function recordOutcome(Request $request, CaseFile $case, Hearing $hearing)
    {
        if ($hearing->lupon_case_id !== $case->id) {
            return $this->notFound('Hearing does not belong to this case');
        }

        /* Validated after the check above, so a hearing from another case is
           reported as that rather than as a form error. */
        $validated = $request->validate(RecordHearingOutcomeRequest::RULES);

        $hearing->update($validated);

        return $this->success($hearing, 'Hearing outcome recorded');
    }

    /**
     * 3.4 — summons and proof of service. `summons_served_date` is the
     * proof-of-service record required before a party can be defaulted.
     */
    public function recordSummons(RecordSummonsRequest $request, Hearing $hearing, PartyNotice $parties)
    {
        if ($refusal = $this->refuseWrongDesk($hearing)) {
            return $refusal;
        }

        $validated = $request->validated();

        if (!empty($validated['summons_served_date']) && !$validated['summons_issued']) {
            return $this->error('A summons cannot be served before it is issued.', 422);
        }

        $case = $hearing->luponCase;
        $firstService = !empty($validated['summons_served_date']) && ! $case->summonsWasServed();

        $hearing->update($validated);

        /*
         * The first served summons is when the case reaches the parties'
         * portals — so it is when they are told it is in their Lupon Records,
         * each from their own side, with the sitting it names. Once per party:
         * recording the same service again tells nobody twice.
         */
        if ($firstService) {
            $parties->recordOpened($case, $hearing->fresh());
        }
        $hearing->load(CaseFile::WITH_PARTIES);

        return $this->success($hearing, 'Summons record updated');
    }

    /**
     * The Barangay Secretary printed the summons.
     *
     * This is the moment the case leaves the Lupon's desk: the paper exists,
     * so the parties are told the schedule and the case appears in their
     * Lupon Records. Pressed again it changes nothing — the summons was
     * printed once, and the parties are told once.
     */
    public function printSummons(Hearing $hearing, PartyNotice $parties)
    {
        $case = $hearing->luponCase;

        if (! $case) {
            return $this->notFound('This hearing is not attached to a case.');
        }

        if ($refusal = $this->refuseWrongDesk($hearing)) {
            return $refusal;
        }

        if ($hearing->status !== 'Scheduled') {
            return $this->error('A summons is printed for a sitting that is still to be held.', 422);
        }

        if (! $case->filing_fee_paid) {
            return $this->error(
                'The filing fee is not marked paid yet. Nothing on the case moves until the Lupon has seen the receipt.',
                422
            );
        }

        $first = ! $hearing->summons_issued;

        if ($first) {
            $hearing->update(['summons_issued' => true, 'summons_printed_at' => ManilaTime::now()]);

            if (in_array($case->current_stage, ['Filed', 'For Summons'], true) && $hearing->hearing_type === 'Mediation') {
                $case->update(['current_stage' => 'Mediation']);
            } elseif ($case->current_stage === 'For Lupon Summons' && $hearing->hearing_type === 'Conciliation') {
                $case->update(['current_stage' => 'Conciliation']);
            }
        }

        /* Once per party, whichever sitting the summons was printed for. */
        $told = $parties->recordOpened($case->fresh(), $hearing->fresh());
        \App\Support\ChangeLog::bump('lupon_cases');

        return $this->success(
            $hearing->fresh()->load(CaseFile::WITH_PARTIES),
            $first
                ? 'Summons marked as printed.' . ($told ? ' The parties were told the schedule.' : '')
                : 'Summons reprinted. The parties were told when it was first printed.'
        );
    }

    /**
     * The sitting was held: the minutes, and what came of it.
     *
     * One of three endings, chosen rather than typed — see HearingSession.
     */
    /**
     * The sitting was held: record or edit the minutes, and what came of it.
     * Authorized Lupon staff (especially Barangay Secretary) can add or edit
     * minutes even for past or already completed hearings.
     */
    public function session(Request $request, Hearing $hearing, HearingSession $session)
    {
        return $this->saveMinutes($request, $hearing, $session);
    }

    /**
     * Records or edits the official minutes / hearing notes / proceedings of a sitting.
     * Allowed even when hearing_date < current_date or status is Completed.
     */
    public function saveMinutes(Request $request, Hearing $hearing, HearingSession $session)
    {
        if (! $hearing->luponCase) {
            return $this->notFound('This hearing is not attached to a case.');
        }

        if ($refusal = $this->refuseWrongDesk($hearing)) {
            return $refusal;
        }

        if ($hearing->status === 'Cancelled') {
            return $this->error('This sitting was cancelled and did not take place.', 422);
        }

        $validated = $request->validate([
            'minutes' => ['required', 'string'],
            'outcome' => ['required', Rule::in(HearingSession::OUTCOMES)],
            'agreement' => ['nullable', 'string', 'required_if:outcome,' . HearingSession::AGREEMENT],
            'complainant_present' => ['nullable', 'boolean'],
            'respondent_present' => ['nullable', 'boolean'],
            'attendance_notes' => ['nullable', 'string'],
            'started_at' => ['nullable', 'date_format:H:i'],
            'ended_at' => ['nullable', 'date_format:H:i', 'after:started_at'],
        ], [
            'minutes.required' => 'Write the minutes of this sitting.',
            'agreement.required_if' => 'Write what the parties agreed to.',
            'ended_at.after' => 'A sitting cannot end before it began.',
        ]);

        $result = $session->recordOrUpdate($hearing, $validated);

        return $this->success(
            ['hearing' => $result['hearing'], 'case' => $result['case']],
            $result['message']
        );
    }

    /**
     * MOVE THE HOUR, NEVER THE DAY.
     */
    public function startTime(Request $request, Hearing $hearing)
    {
        $user = auth()->user();
        $allowedRoles = ['Admin', 'Secretary', 'Clerk', 'Lupon Secretary', 'Punong Barangay'];
        $allowedOffices = ['Admin', 'Main Office', 'Lupon'];
        if ($user && ! in_array($user->role, $allowedRoles, true) && ! in_array($user->office, $allowedOffices, true)) {
            return $this->error('You are not authorized to adjust hearing hours.', 403);
        }

        if ($hearing->status !== 'Scheduled') {
            return $this->error('This sitting is already ' . strtolower($hearing->status) . '.', 422);
        }

        $raw = trim((string) $request->input('start_time'));
        if (! $raw) {
            return $this->error('Say what hour the sitting should begin.', 422);
        }

        // If user entered a range like "8:00 AM – 10:00 AM" or "10:15 - 12:15", take the first part
        if (preg_match('/^(.*?)(?:\s*[\x{2013}\x{2014}\-]\s*.*)$/u', $raw, $m)) {
            $raw = trim($m[1]);
        }

        try {
            $parsed = \Carbon\Carbon::parse($raw);
            $hour = $parsed->hour;
            $minute = $parsed->minute;
        } catch (\Throwable $e) {
            return $this->error('Invalid time format. Please provide an hour such as 10:15 AM or 14:45.', 422);
        }

        $moved = $hearing->scheduled_at->copy()->setTime($hour, $minute, 0);

        // If the hour and minute are already identical, return success immediately
        if ($moved->format('H:i') === $hearing->scheduled_at->format('H:i')) {
            return $this->success(
                $hearing->fresh()->load(CaseFile::WITH_PARTIES),
                'The sitting is already set to begin at ' . $moved->format('g:i A') . '.'
            );
        }

        /* Check if another sitting is scheduled at the same time on the same date */
        $clash = Hearing::where('id', '!=', $hearing->id)
            ->where('hearing_type', $hearing->hearing_type)
            ->whereIn('status', ['Scheduled', 'Completed'])
            ->whereDate('scheduled_at', $moved->toDateString())
            ->whereTime('scheduled_at', $moved->format('H:i:s'))
            ->exists();

        if ($clash) {
            return $this->error('Another sitting is already scheduled at that time. Pick a different time.', 422);
        }

        $hearing->update(['scheduled_at' => $moved]);

        // If requested, also adjust subsequent Scheduled hearings of this case to the same time of day!
        if ($request->boolean('apply_to_subsequent')) {
            $subsequentHearings = Hearing::where('lupon_case_id', $hearing->lupon_case_id)
                ->where('hearing_type', $hearing->hearing_type)
                ->where('status', 'Scheduled')
                ->where('id', '!=', $hearing->id)
                ->where('scheduled_at', '>', $hearing->scheduled_at)
                ->get();

            foreach ($subsequentHearings as $sub) {
                $subMoved = $sub->scheduled_at->copy()->setTime($hour, $minute, 0);

                $subClash = Hearing::where('id', '!=', $sub->id)
                    ->where('hearing_type', $sub->hearing_type)
                    ->whereIn('status', ['Scheduled', 'Completed'])
                    ->whereDate('scheduled_at', $subMoved->toDateString())
                    ->whereTime('scheduled_at', $subMoved->format('H:i:s'))
                    ->exists();

                if (! $subClash) {
                    $sub->update(['scheduled_at' => $subMoved]);
                }
            }
        }

        return $this->success(
            $hearing->fresh()->load(CaseFile::WITH_PARTIES),
            'The sitting now begins at ' . $moved->format('g:i A') . ' on the same day.'
        );
    }

    /*
     * There is no cancel() and no reschedule() any more.
     *
     * Both let an officer move a day the parties had already been summoned
     * to. The barangay sits on fixed days and gives the parties three of
     * them; a sitting called off is somebody who came to the hall for
     * nothing, and one moved is somebody who stayed away on a date that
     * still stood. If the hall cannot sit, the sitting is recorded as
     * unsettled and the next one stands.
     *
     * Sittings are still stood down when a case ENDS — settled, withdrawn,
     * certified to court — but by HearingCalendar, never by hand.
     */
}
