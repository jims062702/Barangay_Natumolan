<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Services\Lupon\FilingFeeDeadlines;
use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\StoreCaseRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Resident\Resident;
use App\Services\Lupon\JurisdictionScreen;
use App\Support\DateWindow;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * The Katarungang Pambarangay docket: filing a complaint, reading a case,
 * and the jurisdiction screen that decides whether the Lupon may hear it.
 */
class CaseController extends BaseController
{
    public function index(Request $request)
    {
        // `settlement` is loaded so the docket can tell a case whose terms are
        // still unrecorded from one already under compliance monitoring —
        // reaching a settlement at mediation advances the stage but does not
        // by itself write the settlement.
        $query = CaseFile::with([
            'assignedLuponSecretary:id,name',
            'complainant:id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,address,contact_number,household_id',
            'complainant.household:id,household_number,street_address',
            'respondents:id,first_name,last_name',
            'settlement:id,lupon_case_id,status',
            /*
             * The fee, on the DOCKET and not only inside the case.
             *
             * The Lupon cannot issue a summons until the Clerk marks it
             * settled, and the only place that showed was the case detail —
             * so finding which cases were ready meant opening them one at a
             * time. A column of badges answers it in one look.
             */
            'payments:id,lupon_case_id,kind,status',
        ]);

        /*
         * Finding a case by what somebody actually has in their hand.
         *
         * The docket could be filtered by stage and period and not SEARCHED —
         * so a complainant at the counter holding a slip that says
         * "KP-2026-0003" meant paging through the list to find it. The case
         * number is the first thing searched, then the title, then either
         * side's name, because those are the three things a person asking
         * "where is my case?" can say.
         *
         * Grouped in one where(), so it narrows the stage and period filters
         * rather than escaping them: an orWhere at the top level would return
         * every case matching the name regardless of the chosen stage.
         */
        if ($request->filled('search')) {
            $rawTerm = trim($request->search);
            $cleanTerm = ltrim($rawTerm, '#');
            $term = '%' . $rawTerm . '%';

            $query->where(function ($q) use ($term, $cleanTerm) {
                $q->where('case_number', 'like', $term)
                    ->orWhere('case_title', 'like', $term)
                    /* The Nature of the Case — the docket's column (a case's title follows it). */
                    ->orWhere('case_classification', 'like', $term)
                    ->orWhere('complainant_name', 'like', $term)
                    ->orWhereHas('complainant', fn ($r) => $r
                        ->where('first_name', 'like', $term)
                        ->orWhere('last_name', 'like', $term))
                    ->orWhereHas('respondents', fn ($r) => $r
                        ->where('first_name', 'like', $term)
                        ->orWhere('last_name', 'like', $term));

                if (is_numeric($cleanTerm)) {
                    $docketNum = (int) $cleanTerm;
                    $q->orWhereRaw('(SELECT COUNT(*) FROM lupon_cases all_c WHERE all_c.date_filed > lupon_cases.date_filed OR (all_c.date_filed = lupon_cases.date_filed AND ((all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NOT NULL AND all_c.case_number >= lupon_cases.case_number) OR (all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NULL) OR (all_c.case_number IS NULL AND lupon_cases.case_number IS NULL AND all_c.id >= lupon_cases.id)))) = ?', [$docketNum]);
                }
            });
        }

        if ($request->filled('current_stage')) {
            $query->where('current_stage', $request->current_stage);
        }
        if ($request->filled('jurisdiction_status')) {
            $query->where('jurisdiction_status', $request->jurisdiction_status);
        }

        /*
         * The period, as Manila calendar days.
         *
         * date_filed is a DATE: no clock, so no timezone to convert. Pushing
         * it through UTC would move a case filed on the 1st back onto the
         * last day of the month before.
         */
        /*
         * Counted BEFORE the window is applied, and after every other filter.
         * "Today: 3" then means three of the cases the clerk is already
         * looking at, not three in the register as a whole.
         */
        $periodCounts = DateWindow::counts($query, 'date_filed', dateOnly: true);

        $window = DateWindow::fromRequest($request);
        $window?->applyTo($query, 'date_filed', dateOnly: true);

        $query->select('lupon_cases.*')
            ->selectRaw('(SELECT COUNT(*) FROM lupon_cases all_c WHERE all_c.date_filed > lupon_cases.date_filed OR (all_c.date_filed = lupon_cases.date_filed AND ((all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NOT NULL AND all_c.case_number >= lupon_cases.case_number) OR (all_c.case_number IS NOT NULL AND lupon_cases.case_number IS NULL) OR (all_c.case_number IS NULL AND lupon_cases.case_number IS NULL AND all_c.id >= lupon_cases.id)))) AS docket_number');

        // Case Docket numbering displayed in REVERSE chronological order (newest/latest case = #1)
        $cases = $query->orderBy('date_filed', 'desc')
            ->orderByRaw("CASE WHEN case_number IS NOT NULL THEN 0 ELSE 1 END ASC")
            ->orderBy('case_number', 'desc')
            ->orderBy('id', 'desc')
            ->paginate(20);

        $payload = $cases->toArray();
        $payload['window'] = $window?->toArray();
        $payload['years'] = DateWindow::yearsFrom(CaseFile::min('date_filed'));
        $payload['period_counts'] = $periodCounts;

        return $this->success($payload, 'Lupon cases retrieved');
    }

    public function store(StoreCaseRequest $request, JurisdictionScreen $screen)
    {
        $validated = $request->validated();

        $respondentIds = collect($validated['respondent_ids'])->unique()->values();
        unset($validated['respondent_ids']);

        // Nobody can be on both sides of the same dispute.
        if (!empty($validated['complainant_id']) && $respondentIds->contains($validated['complainant_id'])) {
            return $this->error(
                'The complainant cannot also be a respondent in the same case.',
                422,
                ['respondent_ids' => ['Remove the complainant from the respondents.']]
            );
        }

        /*
         * The rule the whole docket rests on, and until now only promised.
         *
         * `exists:residents,id` lets a NON-RESIDENT through: they are rows in
         * the same table, put there so families could be recorded whole. But
         * Katarungang Pambarangay jurisdiction follows where the RESPONDENT
         * lives — a case against somebody in another barangay is not this
         * Lupon's to hear, and mediating it produces a settlement no court
         * will honour.
         *
         * The complainant is deliberately not checked: a person wronged by a
         * resident may complain whoever they are and wherever they live.
         */
        $outsiders = Resident::whereIn('id', $respondentIds)
            ->where('record_type', Resident::NON_RESIDENT)
            ->pluck('first_name')
            ->all();

        if ($outsiders !== []) {
            return $this->error(
                implode(', ', $outsiders) . ' ' . (count($outsiders) === 1 ? 'is' : 'are')
                    . ' recorded as living outside Barangay Natumolan. The Lupon can only '
                    . 'hear a case whose respondent lives here — that is what gives it '
                    . 'jurisdiction. The complaint must be filed with the barangay where '
                    . 'they reside.',
                422,
                ['respondent_ids' => ['Each respondent must be a barangay resident.']]
            );
        }

        // A resident complainant supersedes any typed-in details.
        if (!empty($validated['complainant_id'])) {
            $validated['complainant_name'] = null;
            $validated['complainant_address'] = null;
            $validated['complainant_contact'] = null;
        } else {
            $validated['complainant_id'] = null;
        }

        // Hard block: VAWC / child-abuse matters cannot be docketed here.
        if ($screen->mentionsVawc($validated['case_title'], $validated['complaint_narrative'])) {
            return $this->error(
                'This complaint appears to involve violence against women/children. ' .
                'KP mediation is prohibited for VAWC cases — please route the client to the VAWC Desk immediately.',
                422,
                ['routed_to' => 'VAWC']
            );
        }

        /*
         * Manila's date, not the server's. The date is part of the case
         * number now, and a complaint taken at 7 in the morning was being
         * filed — and numbered — on the day before, in UTC.
         */
        $filedOn = ManilaTime::today();

        $case = CaseFile::create([
            'case_number' => null, // Case number is generated once payment is confirmed
            'case_title' => $validated['case_title'],
            'case_classification' => $validated['case_classification'],
            'complainant_id' => $validated['complainant_id'],
            'complainant_name' => $validated['complainant_name'] ?? null,
            'complainant_address' => $validated['complainant_address'] ?? null,
            'complainant_contact' => $validated['complainant_contact'] ?? null,
            'date_filed' => $filedOn,
            'assigned_lupon_secretary' => auth()->id(),
        ]);

        $case->respondents()->sync($respondentIds);

        $case->complaint()->create([
            'complaint_narrative' => $validated['complaint_narrative'],
            'date_of_occurrence' => $validated['date_of_occurrence'],
            'place_of_occurrence' => $validated['place_of_occurrence'],
            'relationship_nature' => $validated['relationship_nature'],
            'complaint_received_date' => now()->toDateString(),
        ]);

        return $this->success(
            $case->load(['complaint', 'respondents:id,first_name,last_name']),
            'Lupon case filed. The filing fee must be paid before a case number and summons are issued.',
            201
        );
    }

    public function show(CaseFile $case)
    {
        $case->load([
            'complaint',
            'assignedLuponSecretary:id,name',
            /*
             * Enough of the register to answer "where do we send the
             * summons?" without asking a resident for an address they have
             * already given. household_id is in the list because the
             * household relation below cannot be loaded without it.
             */
            'complainant:id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,address,contact_number,household_id',
            'complainant.household:id,household_number,street_address',
            'respondents:id,first_name,last_name,zone_purok,contact_number',
            'hearings' => fn ($q) => $q->orderBy('scheduled_at', 'asc'),
            'settlement',
            /* The fees on the case. The Lupon reads these to know whether the
               Clerk has been paid — the summons is blocked until it has. */
            'payments' => fn ($q) => $q->orderBy('requested_at')->with('paidBy:id,name'),
        ]);

        return $this->success($case, 'Lupon case retrieved');
    }

    /*
     * There is no screenJurisdiction() any more, and deliberately so.
     *
     * The screen belongs to FILING, where store() above runs it: a matter that
     * reads as VAWC is refused with a 422 and never becomes a case, and a
     * respondent living outside the barangay is refused in the same breath.
     * Re-running it on a case that already exists could only confirm what the
     * case already said — nothing in the system edits a filed narrative or
     * takes a respondent off a case, so neither input can have changed.
     *
     * Checked against the register before it went: no case on file would have
     * come out differently. The screen itself (JurisdictionScreen) stays —
     * store() is what calls it.
     */

    /**
     * The respondent, named on a case that has NONE — a case accepted from an
     * online complaint before the respondent was required there (2026-09-29).
     *
     * Only while it has none: a case that names its respondent keeps them,
     * because parties are not swapped on a filed case. The same checks as
     * filing: on the register, not the complainant, and living here (KP
     * jurisdiction follows the respondent).
     */
    public function nameRespondents(Request $request, CaseFile $case)
    {
        if ($case->respondents()->exists()) {
            return $this->error('This case already names its respondent. Parties are not changed on a filed case.', 409);
        }

        $validated = $request->validate([
            'respondent_ids' => 'required|array|min:1',
            'respondent_ids.*' => 'integer|exists:residents,id',
        ], [
            'respondent_ids.required' => 'Choose the respondent on the register.',
            'respondent_ids.min' => 'Choose the respondent on the register.',
        ]);

        $ids = collect($validated['respondent_ids'])->map(fn ($id) => (int) $id)->unique()->values();

        if ($case->complainant_id && $ids->contains((int) $case->complainant_id)) {
            return $this->error('The complainant cannot also be the respondent.', 422,
                ['respondent_ids' => ['The complainant cannot also be the respondent.']]);
        }

        $outsiders = Resident::whereIn('id', $ids)->where('record_type', Resident::NON_RESIDENT)->pluck('first_name')->all();
        if ($outsiders !== []) {
            return $this->error(
                implode(', ', $outsiders) . ' ' . (count($outsiders) === 1 ? 'is' : 'are')
                    . ' recorded as living outside Barangay Natumolan. The Lupon can only hear a case whose '
                    . 'respondent lives here.',
                422,
                ['respondent_ids' => ['Each respondent must be a barangay resident.']]
            );
        }

        $case->respondents()->sync($ids->all());
        $names = Resident::whereIn('id', $ids)->get()->map->full_name->implode(', ');
        FilingFeeDeadlines::record($case, 'respondent_named', 'Respondent named on the register: ' . $names . '.');
        \App\Support\ChangeLog::bump('lupon_cases');

        return $this->success($case->fresh(), 'Respondent set: ' . $names . '.');
    }

    /**
     * Refer case from Punong Barangay mediation stage to Secretary / Lupon conciliation.
     * Allowed only if at least 1 mediation hearing has been completed and case is not settled.
     * Cancels any remaining scheduled Punong Barangay hearings, freeing up the queue for subsequent cases.
     */
    public function referToSecretary(Request $request, CaseFile $case)
    {
        $user = auth()->user();
        $allowed = ['Punong Barangay', 'Secretary', 'Admin'];
        if ($user && !in_array($user->role, $allowed, true) && !in_array($user->office, ['Main Office', 'Lupon', 'Admin'], true)) {
            return $this->error('You are not authorized to refer this case.', 403);
        }

        if (in_array($case->current_stage, ['Settled', 'Repudiated', 'CFA', 'Withdrawn', 'Closed — Unpaid', 'Closed Unpaid'], true)) {
            return $this->error('This case is already ' . strtolower($case->current_stage) . ' and cannot be referred.', 422);
        }

        $completedMediation = $case->hearings()
            ->where('hearing_type', 'Mediation')
            ->where('status', 'Completed')
            ->count();

        if ($completedMediation < 1) {
            return $this->error(
                'The Punong Barangay must conduct at least 1 mediation hearing before referring the case to the Secretary / Lupon.',
                422
            );
        }

        DB::transaction(function () use ($case, $completedMediation) {
            // Cancel remaining scheduled mediation hearings
            $case->hearings()
                ->where('hearing_type', 'Mediation')
                ->where('status', 'Scheduled')
                ->update([
                    'status' => 'Cancelled',
                    'cancellation_reason' => 'Referred by Punong Barangay to Secretary / Lupon conciliation.',
                ]);

            // Update case stage to For Lupon Summons
            $note = 'Referred by Punong Barangay to Secretary on ' . now()->toDateString() . ' after ' . $completedMediation . ' mediation hearing(s).';
            $case->update([
                'current_stage' => 'For Lupon Summons',
                'notes' => trim(($case->notes ? $case->notes . "\n" : '') . $note),
            ]);

            FilingFeeDeadlines::record($case, 'referred_to_lupon', $note);
            \App\Support\ChangeLog::bump('lupon_cases');
            \App\Support\ChangeLog::bump('lupon_hearings');
        });

        return $this->success(
            $case->fresh()->load([
                'hearings' => fn ($q) => $q->orderBy('scheduled_at', 'asc'),
                'complainant',
                'respondents',
            ]),
            'Case successfully referred to Secretary / Lupon. Remaining Punong Barangay mediation hearings have been removed from the schedule.'
        );
    }
}
