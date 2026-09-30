<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\StoreFollowupRequest;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Followup;
use Illuminate\Http\Request;

/**
 * Follow-up visits and calls, and the desk-wide monitoring list.
 */
class FollowupController extends BaseController
{
    /** 2.6 — intervention monitoring across every open case. */
    public function index(Request $request)
    {
        $query = Followup::with(['vawcCase:id,case_code,violence_type,status', 'recorder:id,name']);

        if ($request->filled('safety_status')) {
            $query->where('safety_status', $request->safety_status);
        }

        if ($request->filled('protection_order_status')) {
            $query->where('protection_order_status', $request->protection_order_status);
        }

        if ($request->boolean('closure_recommended')) {
            $query->where('closure_recommended', true);
        }

        // Only visits whose next check-in is already due, on cases still open.
        if ($request->boolean('due')) {
            $query->whereNotNull('next_followup_date')
                ->whereDate('next_followup_date', '<=', today())
                ->whereHas('vawcCase', fn ($q) => $q->where('status', 'Active'));
        }

        return $this->success(
            $query->orderBy('followup_date', 'desc')->orderBy('id', 'desc')->paginate(20),
            'VAWC follow-ups retrieved'
        );
    }

    public function store(StoreFollowupRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        $followup = $case->followups()->create($validated + ['recorded_by' => auth()->id()]);

        /*
         * And the docket's risk level moves with it.
         *
         * Without this the list would show, a year on, the level somebody
         * assessed on the first day — which is worse than showing nothing,
         * because it looks current. See CaseFile::RISK_FROM_SAFETY for why
         * "Unknown" deliberately moves nothing.
         */
        $case->reassessRiskFrom($validated['safety_status'], $validated['followup_date']);

        AccessLog::record($case->id, 'followup_recorded', $validated['safety_status']);

        return $this->success($followup, 'Follow-up recorded', 201);
    }
}
