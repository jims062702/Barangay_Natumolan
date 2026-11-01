<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Services\Lupon\FilingFeeDeadlines;
use App\Services\Lupon\HearingCalendar;
use App\Services\Lupon\HearingDesk;
use App\Services\Lupon\PartyNotice;
use App\Support\ChangeLog;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * The summons, and the calendar it brings with it.
 *
 * PRINTING THE SUMMONS IS WHAT BOOKS THE SITTINGS. Nothing goes on the
 * calendar before the paper exists, because the paper is what names the day
 * to the parties — three Tuesdays standing on a calendar that nobody has
 * been told about are three days nobody attends.
 *
 * It happens twice in a case's life, at two desks:
 *
 *   For Summons         the Barangay Secretary prints, and three Tuesdays
 *                       with the Punong Barangay follow
 *   For Lupon Summons   the Tuesdays are spent with no agreement, so the
 *                       Lupon prints again and three Thursdays follow
 *
 * Both times the Notice of Hearing goes to the complainant and the Summons
 * to the respondent — two papers, two people — and both times the parties
 * are told once, here, at the moment the printing happens.
 */
class SummonsController extends BaseController
{
    /** Which sittings a case's papers belong to, at the stage it stands. */
    private const TYPE_FOR_STAGE = [
        'For Summons' => 'Mediation',
        'Mediation' => 'Mediation',
        'For Lupon Summons' => 'Conciliation',
        'Conciliation' => 'Conciliation',
    ];

    /**
     * THE PRINT REGISTER: every live case, and whether its papers are out.
     *
     * A CASE DOES NOT LEAVE THIS LIST WHEN IT IS PRINTED. It used to: the
     * row vanished the moment the Secretary pressed the button, so the one
     * question the office actually asks here — "has the notice of hearing
     * and the summons gone out on this case?" — could only be answered by
     * the row's absence, which is no answer at all. A clerk interrupted
     * mid-press, or a second clerk arriving after, had nothing to read.
     *
     * So the list holds every case from the moment the fee is confirmed
     * until it closes, and each row says which desk it is on and whether
     * that desk's papers have been printed. A case reaching the Lupon
     * appears as unprinted again, because the Lupon's own summons is a
     * second paper that has not been issued yet.
     */
    /**
     * SQL for "the papers this case's stage calls for have been printed".
     *
     * A case carried over from the old order stands at Mediation with three
     * Tuesdays on the calendar and no summons ever printed — genuinely
     * unprinted work, which a test on the stage alone would miss.
     */
    private function printedCount(): string
    {
        return "(SELECT COUNT(*) FROM lupon_hearings h
                 WHERE h.lupon_case_id = lupon_cases.id
                   AND h.summons_issued = 1
                   AND h.hearing_type = CASE
                         WHEN lupon_cases.current_stage IN ('For Lupon Summons','Conciliation')
                         THEN 'Conciliation' ELSE 'Mediation' END)";
    }

    public function awaiting(Request $request)
    {
        FilingFeeDeadlines::forwardCompletedMediation();
        $office = $request->user()?->office;
        $allowedStages = match ($office) {
            'Lupon' => ['For Lupon Summons', 'Conciliation'],
            'Main Office' => ['For Summons', 'Mediation'],
            default => array_keys(self::TYPE_FOR_STAGE),
        };

        $live = fn ($q) => $q->whereIn('current_stage', $allowedStages);

        /* The figure the desk's badge and tile both report: work, not rows. */
        $unprinted = CaseFile::where($live)->whereRaw($this->printedCount() . ' = 0')->count();

        $cases = CaseFile::select('lupon_cases.*')
            ->selectRaw('(SELECT COUNT(*) FROM lupon_cases all_c WHERE all_c.date_filed > lupon_cases.date_filed OR (all_c.date_filed = lupon_cases.date_filed AND ((all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NOT NULL AND all_c.case_number >= lupon_cases.case_number) OR (all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NULL) OR (all_c.case_number IS NULL AND lupon_cases.case_number IS NULL AND all_c.id >= lupon_cases.id)))) AS docket_number')
            ->with([
                'complainant:id,first_name,middle_name,last_name',
                'respondents:id,first_name,middle_name,last_name',
                'hearings:id,lupon_case_id,hearing_type,summons_issued,summons_printed_at,scheduled_at',
            ])
            ->where($live)
            /*
             * UNPRINTED FIRST, reverse chronological within each (newest case = #1).
             */
            ->orderByRaw($this->printedCount() . ' ASC')
            ->orderBy('date_filed', 'desc')
            ->orderByRaw("CASE WHEN case_number IS NOT NULL THEN 0 ELSE 1 END ASC")
            ->orderBy('case_number', 'desc')
            ->orderBy('id', 'desc')
            ->paginate(20);

        $cases->getCollection()->transform(function (CaseFile $case) {
            $type = self::TYPE_FOR_STAGE[$case->current_stage] ?? 'Mediation';

            $printed = $case->hearings
                ->where('hearing_type', $type)
                ->where('summons_issued', true)
                ->sortBy('summons_printed_at')
                ->first();

            $case->setAttribute('papers_for', $type);
            $case->setAttribute('papers_printed_at', $printed?->summons_printed_at);
            /* The sitting the papers name, for a reprint from this screen. */
            $case->setAttribute('papers_hearing_id', $printed?->id);

            return $case;
        });

        /* `unprinted` beside the rows, because the tile above them counts
           work across the whole register and not just this page. */
        return $this->success($cases->toArray() + ['unprinted' => $unprinted], 'Cases retrieved');
    }

    /**
     * Whether this case's papers may be printed at this desk now — the
     * sittings' type when they may, the refusal when not.
     */
    private function mayPrint(CaseFile $case): string|\Illuminate\Http\JsonResponse
    {
        if ($case->isClosed()) {
            return $this->error('This case is closed as ' . strtolower($case->current_stage) . '.', 422);
        }

        $desk = HearingDesk::forStage($case->current_stage);

        if (! $desk) {
            return $this->error(
                'This case is not waiting on a summons — it stands at ' . $case->current_stage . '.',
                422
            );
        }

        if (! HearingDesk::may(auth()->user(), $desk)) {
            return $this->error(HearingDesk::refusal($desk), 403);
        }

        if (! $case->filing_fee_paid) {
            return $this->error(
                'The filing fee is not marked paid yet. Nothing on the case moves until the Lupon has seen the receipt.',
                422
            );
        }

        if ($desk === HearingDesk::CONCILIATION_DESK) {
            if (! $case->isEligibleForLuponConciliation()) {
                return $this->error(
                    'Lupon conciliation summons cannot be printed. All 3 Punong Barangay mediation sessions must be concluded first.',
                    422
                );
            }
        }

        return $desk === HearingDesk::MEDIATION_DESK ? 'Mediation' : 'Conciliation';
    }

    /**
     * The sittings printing the papers now would book — for the papers
     * themselves, which are printed BEFORE anything is booked.
     */
    public function plan(CaseFile $case, HearingCalendar $calendar)
    {
        $type = $this->mayPrint($case);
        if (! is_string($type)) {
            return $type;
        }

        return $this->success([
            'hearings' => collect($calendar->plan($case, $type, Carbon::now(ManilaTime::ZONE)))
                /* The hall's own clock, as every sitting is kept and read (no zone to shift it). */
                ->map(fn (Carbon $at) => ['hearing_type' => $type, 'scheduled_at' => $at->format('Y-m-d\TH:i:s'), 'status' => 'Scheduled'])
                ->values(),
        ], 'The sittings these papers would book');
    }

    /**
     * The papers PRINTED — said by the office once they are in its hand
     * (2026-09-29): the sittings are booked, and the parties are told.
     *
     * Not before. Pressing Print used to book the calendar and tell both
     * parties first, so a print cancelled at the dialog still showed as
     * "Printed" with nobody holding a paper. The page prints from plan()
     * and asks "Did it print?"; only a yes arrives here — with the first
     * sitting the papers name, which must still be the one that would be
     * booked (another case may have taken that hour meanwhile).
     *
     * Pressed again on a case already past this point it changes nothing and
     * says so — the summons is reprinted from the case's own forms screen,
     * which does not touch the calendar.
     */
    /**
     * Automatic hearing schedule generation and Summon creation.
     * If no hearing exists, automatically creates first hearing (8:00 AM – 10:00 AM, or next available slot).
     * If hearing already exists, reuses existing hearing without duplicating.
     * If previous completed hearings exist, creates next available hearing slot with 15-minute buffer.
     */
    public function generateSummon(Request $request, CaseFile $case, HearingCalendar $calendar, PartyNotice $parties)
    {
        $type = $this->mayPrint($case);
        if (! is_string($type)) {
            return $type;
        }

        $result = $calendar->getOrCreateHearing($case, $type, Carbon::now(ManilaTime::ZONE), false);
        $hearing = $result['hearing'];
        $reused = $result['reused'];
        $scheduleMessage = $result['message'];

        $told = false;
        if ($hearing->summons_issued) {
            $told = $parties->recordOpened($case->fresh(), $hearing);
        }

        ChangeLog::bump('lupon_cases');

        $userMessage = $reused
            ? $scheduleMessage
            : ('Summon generated successfully. ' . $scheduleMessage);

        return $this->success(
            [
                'case' => $case->fresh()->load('hearings'),
                'hearing' => $hearing->fresh()->load(CaseFile::WITH_PARTIES),
                'reused' => $reused,
                'schedule_message' => $scheduleMessage,
                'schedule_time_range' => $hearing->schedule_time_range,
            ],
            $userMessage
        );
    }

    /**
     * Explicitly schedules the next hearing for a case when previous hearings have concluded.
     */
    public function scheduleNextHearing(CaseFile $case, HearingCalendar $calendar)
    {
        if ($case->isClosed()) {
            return $this->error('This case is closed; nothing more is scheduled on it.', 422);
        }

        $type = ($case->current_stage === 'Conciliation' || $case->current_stage === 'For Lupon Summons')
            ? 'Conciliation'
            : 'Mediation';

        if ($type === 'Conciliation') {
            if (! $case->isEligibleForLuponConciliation()) {
                return $this->error('A case must complete all 3 Punong Barangay mediation sessions before Lupon hearings can be scheduled.', 422);
            }
        }

        // Check if there is already an active scheduled hearing
        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Scheduled')
            ->first();

        if ($existing) {
            $dayName = $existing->scheduled_at->format('l, F j, Y');
            return $this->error("A hearing is already scheduled for this case on {$dayName}.", 422);
        }

        $result = $calendar->getOrCreateHearing($case, $type, Carbon::now(ManilaTime::ZONE), false);
        ChangeLog::bump('lupon_cases');

        return $this->success(
            [
                'case' => $case->fresh()->load('hearings'),
                'hearing' => $result['hearing']->fresh()->load(CaseFile::WITH_PARTIES),
                'reused' => $result['reused'],
                'message' => $result['message'],
            ],
            $result['message']
        );
    }

    public function issue(Request $request, CaseFile $case, HearingCalendar $calendar, PartyNotice $parties)
    {
        $type = $this->mayPrint($case);
        if (! is_string($type)) {
            return $type;
        }
        $mediation = $type === 'Mediation';

        $request->validate(['expect_first' => ['nullable', 'regex:/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/']]);

        if ($request->filled('expect_first')) {
            $planned = $calendar->plan($case, $type, Carbon::now(ManilaTime::ZONE));
            /* Compared on the hall's clock, the way the papers print it. */
            $printed = substr(str_replace('T', ' ', (string) $request->input('expect_first')), 0, 16);

            if (! $planned || $planned[0]->format('Y-m-d H:i') !== $printed) {
                return response()->json([
                    'success' => false,
                    'message' => 'The first sitting is now ' . ($planned[0] ?? null)?->format('l, F j, Y g:i A')
                        . ' — not the day and hour on the papers just printed (another case took that slot, '
                        . 'or the day changed). Nothing was booked. Print the papers again.',
                    'data' => ['hearings' => collect($planned)->map(fn (Carbon $at) => $at->format('Y-m-d\TH:i:s'))->values()],
                ], 409);
            }
        }

        /*
         * Schedule the 3 hearings and mark summons as printed on the first hearing.
         */
        $hearings = $calendar->schedule($case, $type, Carbon::now(ManilaTime::ZONE), true);

        $case->update(['current_stage' => $mediation ? 'Mediation' : 'Conciliation']);

        $now = ManilaTime::now();
        foreach ($hearings as $h) {
            if (! $h->summons_printed_at) {
                $h->update(['summons_issued' => true, 'summons_printed_at' => $now]);
            }
        }

        $first = collect($hearings)->sortBy('scheduled_at')->first();
        $first?->refresh();

        $told = $parties->recordOpened($case->fresh(), $first);

        ChangeLog::bump('lupon_cases');

        return $this->success(
            [
                'case' => $case->fresh()->load('hearings'),
                'hearings' => collect($hearings)->sortBy('scheduled_at')->values(),
            ],
            sprintf(
                'Summons printed. Three %s%s with the %s are on the calendar.%s',
                $mediation ? 'Tuesday' : 'Thursday',
                's',
                $mediation ? 'Punong Barangay' : 'Lupon',
                $told ? ' Both parties were told the schedule.' : ''
            )
            . ($first ? ' The first sitting is on ' . $first->scheduled_at->format('F j, Y g:i A') . '.' : '')
        );
    }
}
