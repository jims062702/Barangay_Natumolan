<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\StoreCaseRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Resident\Resident;
use App\Services\Lupon\JurisdictionScreen;
use App\Support\DateWindow;
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
        ]);

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

        // Newest case first, and always in case-number sequence: numbers are
        // issued in order, so id order is case-number order. Ordering by
        // date_filed alone left cases filed on the same day unsorted.
        $cases = $query->orderByDesc('id')->paginate(20);

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

        $case = CaseFile::create([
            'case_number' => CaseFile::nextCaseNumber(),
            'case_title' => $validated['case_title'],
            'case_classification' => $validated['case_classification'],
            'complainant_id' => $validated['complainant_id'],
            'complainant_name' => $validated['complainant_name'] ?? null,
            'complainant_address' => $validated['complainant_address'] ?? null,
            'complainant_contact' => $validated['complainant_contact'] ?? null,
            'date_filed' => now()->toDateString(),
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

        return $this->success($case->load(['complaint', 'respondents:id,first_name,last_name']), 'Lupon case filed', 201);
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
            'hearings' => fn ($q) => $q->orderBy('scheduled_at', 'desc'),
            'settlement',
        ]);

        return $this->success($case, 'Lupon case retrieved');
    }

    public function screenJurisdiction(CaseFile $case, JurisdictionScreen $screen)
    {
        if ($screen->mentionsVawc($case->case_title, $case->complaint->complaint_narrative ?? '')) {
            $case->update([
                'jurisdiction_status' => 'Rejected',
                'rejection_reason' => 'VAWC/child-abuse case — must be routed to the VAWC Desk (KP mediation prohibited)',
                'current_stage' => 'Referred',
            ]);

            return $this->success($case, 'Case rejected and flagged for VAWC referral');
        }

        /*
         * Jurisdiction rests on the respondent living here — a complainant
         * from another barangay is perfectly entitled to file against one of
         * our residents. Only a missing/non-resident respondent defeats it.
         */
        if ($case->respondents()->count() === 0) {
            $case->update([
                'jurisdiction_status' => 'Rejected',
                'rejection_reason' => 'No barangay-resident respondent on this case — file with the barangay where they reside',
            ]);

            return $this->success($case, 'Case rejected - jurisdiction requirement not met');
        }

        $case->update(['jurisdiction_status' => 'Accepted']);

        return $this->success($case, 'Jurisdiction screening complete — case accepted');
    }
}
