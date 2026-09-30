<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\StoreReferralRequest;
use App\Http\Requests\Vawc\UpdateReferralRequest;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Referral;
use Illuminate\Http\Request;

/**
 * Referrals to partner agencies, from a case and from the desk-wide list
 * of referrals owed a response.
 */
class ReferralController extends BaseController
{
    /** 2.5 — every referral across the desk, with its response state. */
    public function index(Request $request)
    {
        $query = Referral::with(['vawcCase:id,case_code,violence_type,status', 'referrer:id,name']);

        if ($request->filled('referral_agency')) {
            $query->where('referral_agency', $request->referral_agency);
        }

        if ($request->filled('referral_status')) {
            $query->where('referral_status', $request->referral_status);
        }

        if ($request->filled('urgency')) {
            $query->where('urgency', $request->urgency);
        }

        // Referrals whose agreed follow-up date has arrived and that are
        // still open — the chase list.
        if ($request->boolean('due')) {
            $query->whereNotNull('followup_schedule')
                ->whereDate('followup_schedule', '<=', today())
                ->where('is_completed', false);
        }

        return $this->success(
            $query->orderBy('referral_date', 'desc')->orderBy('id', 'desc')->paginate(20),
            'VAWC referrals retrieved'
        );
    }

    public function store(StoreReferralRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        /* Whoever records it is who referred her — shown, not typed. */
        $referral = $case->referrals()->create($validated + [
            'referred_by' => auth()->id(),
        ]);

        AccessLog::record($case->id, 'referral_added', $validated['referral_agency']);

        return $this->success($referral->fresh()->load('referrer:id,name'), 'Referral created.', 201);
    }

    public function update(Request $request, CaseFile $case, Referral $referral)
    {
        if ($referral->vawc_case_id !== $case->id) {
            return $this->notFound('Referral does not belong to this case');
        }

        $validated = $request->validate(UpdateReferralRequest::rulesFor());

        $referral->update($validated);

        AccessLog::record($case->id, 'referral_updated', $referral->referral_agency . ': ' . $referral->referral_status);

        return $this->success($referral->fresh()->load('referrer:id,name'), 'Referral updated.');
    }

    /** Update a referral from the desk-wide list (no case id in the path). */
    public function updateFromDesk(UpdateReferralRequest $request, Referral $referral)
    {
        $validated = $request->validated();

        $referral->update($validated);

        AccessLog::record($referral->vawc_case_id, 'referral_updated', $referral->referral_agency . ': ' . $referral->referral_status);

        $referral->load(['vawcCase:id,case_code,violence_type,status', 'referrer:id,name']);

        return $this->success($referral, 'Referral updated');
    }
}
