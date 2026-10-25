<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Vawc\FileOnlineReportRequest;
use App\Models\Resident\Resident;
use App\Models\Vawc\OnlineReport;
use App\Services\Resident\ResidentCards;
use App\Services\Vawc\OnlineReports;
use App\Services\Vawc\VawcComplainant;

/**
 * The resident's own VAWC reports, on their portal — sending one, and
 * following it.
 *
 * The office asked for them to be here (2026-09-28). What is shown is the
 * least that answers "what happens next?": the reference number, the date,
 * where it stands, and the next step. Not what she wrote, and not the case
 * behind it — a portal may be opened on a phone somebody else picks up.
 */
class VawcReportController extends PortalController
{
    public function index()
    {
        $reports = OnlineReport::where('resident_id', $this->residentId())
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (OnlineReport $r) => [
                'reference_no' => $r->reference_no,
                'status' => $r->status,
                'sent_at' => $r->created_at?->toIso8601String(),
                'visit_required' => $r->visit_required,
                'next_step' => OnlineReports::nextStep($r),
            ]);

        return $this->success($reports, 'Your VAWC online complaints');
    }

    public function store(FileOnlineReportRequest $request, ResidentCards $cards, OnlineReports $reports)
    {
        $resident = Resident::find($this->residentId());
        if (! $resident) {
            return $this->notFound('No resident record is linked to your account');
        }

        $data = $request->validated();

        /* Her own card: valid, current, and the card of this account. */
        $check = $cards->verify($data['resident_card_code']);
        if ($check['ok'] && $check['resident']->id !== $resident->id) {
            $check = ['ok' => false, 'message' => 'This Resident ID belongs to another resident. Upload your own — you can download it from My Profile.'];
        }
        /* Filed by a woman — her own record says so (VawcComplainant). */
        if ($check['ok'] && ($refusal = VawcComplainant::onlineRefusal($resident))) {
            $check = ['ok' => false, 'message' => $refusal];
        }
        if (! $check['ok']) {
            return $this->error($check['message'], 422, ['resident_card_code' => [$check['message']]]);
        }

        $report = $reports->file(
            $data,
            $resident,
            $check['card'],
            OnlineReport::VIA_PORTAL,
            $request->file('valid_id'),
            $request->file('evidence', [])
        );

        return $this->success([
            'reference_no' => $report->reference_no,
            'status' => $report->status,
            'visit_required' => $report->visit_required,
        ], 'Your complaint was received as ' . $report->reference_no . '. ' . OnlineReports::nextStep($report), 201);
    }
}
