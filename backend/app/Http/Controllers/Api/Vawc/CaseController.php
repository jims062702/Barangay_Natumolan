<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\StoreCaseRequest;
use App\Http\Requests\Vawc\UpdateCaseRequest;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Followup;
use App\Services\Vawc\CaseIntake;
use App\Support\DateWindow;
use Illuminate\Http\Request;

/**
 * VAWC Desk cases. The whole route group is gated to office:VAWC only —
 * no PB/Admin bypass. Every access to a case is written to vawc_access_logs.
 */
class CaseController extends BaseController
{
    public function index(Request $request)
    {
        $query = CaseFile::with(['officer:id,name'])->where('status', '!=', 'Archived');

        if ($request->filled('status')) {
            if ($request->status !== 'all') {
                $query->where('status', $request->status);
            }
        } else {
            $query->where('status', 'Active');
        }
        /*
         * Filtering on the LIST, not the one-word column.
         *
         * A case that is two kinds stores "Mixed" in that column, so asking
         * for Physical returned every case that was ONLY physical and hid
         * the ones where a beating came with threats — exactly the cases a
         * desk filtering for physical violence most needs to see.
         */
        if ($request->filled('violence_type')) {
            $kind = $request->violence_type;
            $query->where(fn ($q) => $q
                ->whereJsonContains('violence_types', $kind)
                ->orWhere(fn ($old) => $old
                    ->where('violence_type', $kind)
                    ->where(fn ($none) => $none
                        ->whereNull('violence_types')
                        ->orWhereJsonLength('violence_types', 0))));
        }
        if ($request->filled('risk_level')) {
            $query->where('risk_level', $request->risk_level);
        }

        /*
         * The period, worked out in Philippine time.
         *
         * report_date carries a clock, so the window is converted to UTC
         * before it meets the column — a Manila day runs from 16:00 the
         * previous day in the stored values.
         */
        /*
         * Counted BEFORE the window is applied, and after every other filter.
         * "Today: 3" then means three of the cases the clerk is already
         * looking at, not three in the register as a whole.
         */
        $periodCounts = DateWindow::counts($query, 'report_date');

        $window = DateWindow::fromRequest($request);
        $window?->applyTo($query, 'report_date');

        /*
         * Most urgent first, and only then most recent.
         *
         * A docket sorted by date alone buries a Critical case from March
         * under a Low one filed this morning — and the whole reason the
         * office opens this page is to find out who to see first. MySQL has
         * no order for the enum's words, so the order is stated.
         */
        $cases = $query
            ->orderByRaw("FIELD(risk_level, 'Critical', 'High', 'Medium', 'Low') ASC")
            ->orderBy('report_date', 'desc')
            ->paginate(20);

        /*
         * When each is next due, and when it was last touched.
         *
         * Loaded for the page rather than per row: twenty cases would
         * otherwise be twenty extra queries, and a docket that is slow to
         * open is a docket nobody opens.
         */
        $ids = $cases->getCollection()->pluck('id');

        $nextDue = Followup::whereIn('vawc_case_id', $ids)
            ->whereNotNull('next_followup_date')
            ->selectRaw('vawc_case_id, MIN(next_followup_date) as due')
            ->groupBy('vawc_case_id')
            ->pluck('due', 'vawc_case_id');

        $lastSeen = Followup::whereIn('vawc_case_id', $ids)
            ->selectRaw('vawc_case_id, MAX(followup_date) as seen')
            ->groupBy('vawc_case_id')
            ->pluck('seen', 'vawc_case_id');

        $cases->getCollection()->transform(function (CaseFile $case) use ($nextDue, $lastSeen) {
            $case->next_followup_date = $nextDue[$case->id] ?? null;
            $case->last_followup_date = $lastSeen[$case->id] ?? null;

            return $case;
        });

        /*
         * The window goes back with the rows so the page can say which one it
         * is showing, and the years so the dropdown offers only years that
         * have cases in them.
         */
        $payload = $cases->toArray();
        $payload['window'] = $window?->toArray();
        $payload['years'] = DateWindow::yearsFrom(CaseFile::min('report_date'));
        $payload['period_counts'] = $periodCounts;

        return $this->success($payload, 'VAWC cases retrieved');
    }

    public function store(StoreCaseRequest $request, CaseIntake $intake)
    {
        $case = $intake->open($request->validated());

        /*
         * Reloaded, so the reply carries every column and not only the ones
         * that happened to be filled in. A caller reading risk_level should
         * get null when nothing was assessed — not find the key missing and
         * have to guess what that means.
         */
        return $this->success(
            $case->fresh()->load('dependents:id,first_name,middle_name,last_name,resident_number'),
            'VAWC case created',
            201
        );
    }

    public function show(CaseFile $case)
    {
        $case->load(['survivor:id,first_name,last_name,zone_purok,contact_number',
            'reporter:id,resident_number,first_name,middle_name,last_name,suffix,record_type',
            /*
             * Enough of the respondent to draw a protection order against
             * them: item 4 of the application asks for the birth date, sex,
             * address, telephone, occupation and civil status, and reading
             * them from the register rather than from a copy taken at intake
             * means the order is served on where they live NOW.
             */
            'respondent:id,resident_number,first_name,middle_name,last_name,suffix,gender,birthdate,civil_status,occupation,zone_purok,address,contact_number,record_type',
            'dependents:id,first_name,middle_name,last_name,resident_number,birthdate,gender', 'officer:id,name', 'incidents',
            'referrals.referrer:id,name', 'followups.recorder:id,name', 'documents.uploader:id,name',
            /* Every BPO, newest first — each renewal is its own row. */
            'protectionOrders.recorder:id,name',
            'assessment.recorder:id,name',
            'childWelfare.recorder:id,name',
            /* The one dialogue, when there was one. */
            'agreement.recorder:id,name']);

        AccessLog::record($case->id, 'viewed', 'Full case viewed');

        return $this->success($case, 'VAWC case retrieved');
    }

    public function update(UpdateCaseRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        if ($case->status === 'Closed' && ($validated['status'] ?? 'Closed') === 'Closed') {
            return $this->error('Closed VAWC cases are read-only and cannot be modified.', 422);
        }

        // Re-pointing a case at a different person is the single most
        // sensitive edit here, so it is named explicitly in the trail.
        if (array_key_exists('survivor_id', $validated) && $validated['survivor_id'] !== $case->survivor_id) {
            AccessLog::record($case->id, 'survivor_changed', 'Survivor record re-linked');
        }

        if (($validated['status'] ?? null) === 'Closed' && $case->status !== 'Closed') {
            $validated['closed_at'] = now();
            AccessLog::record($case->id, 'case_closed', 'Case closed');
        } elseif (($validated['status'] ?? null) === 'Active' && $case->status === 'Closed') {
            $validated['closed_at'] = null;
            AccessLog::record($case->id, 'case_reopened', 'Case reopened');
        }

        /* She reported it herself: nobody else's details stay on the case. */
        if (($validated['reported_by_type'] ?? null) === 'Victim-Survivor') {
            foreach (['reported_by_name', 'reported_by_resident_id', 'reported_by_relationship',
                'reported_by_contact', 'applicant_consent'] as $field) {
                $validated[$field] = null;
            }
        }

        /*
         * The immediate safety assessment, updated.
         *
         * In danger right now is Critical, whatever level was chosen. Any
         * level set here is dated, so a stale one is visibly stale.
         */
        $safety = array_intersect_key($validated, array_flip(['currently_in_danger', 'protection_needed', 'risk_level']));

        if ($safety !== []) {
            if ($level = CaseFile::riskFromDanger($validated['currently_in_danger'] ?? $case->currently_in_danger)) {
                $validated['risk_level'] = $level;
            }

            if (array_key_exists('risk_level', $validated)) {
                $validated['risk_assessed_at'] = now();
            }
        }

        if (array_key_exists('dependent_ids', $validated)) {
            $dependentIds = collect($validated['dependent_ids'] ?? [])->unique()->values();
            $case->dependents()->sync($dependentIds);
            $validated['children_count'] = $dependentIds->count();
            $validated['children_involved'] = $dependentIds->isNotEmpty();
        }
        unset($validated['dependent_ids']);

        $case->update($validated);

        AccessLog::record(
            $case->id,
            $safety !== [] ? 'safety_assessed' : 'updated',
            $safety !== []
                ? 'In danger: ' . ($case->currently_in_danger ?? '—') . ' · Protection needed: ' . ($case->protection_needed ?? '—')
                : 'Case fields updated'
        );

        return $this->success($case->load('dependents:id,first_name,middle_name,last_name,resident_number'), 'VAWC case updated');
    }
}
