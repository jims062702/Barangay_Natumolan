<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\FileOnlineReportRequest;
use App\Models\Vawc\OnlineReport;
use App\Services\Resident\ResidentCards;
use App\Services\Vawc\OnlineReports;
use App\Services\Vawc\VawcComplainant;

/**
 * A VAWC online complaint from the public page — by a WOMAN who is a
 * resident, identified by her Barangay Resident ID, about a respondent she
 * names in her own words. See App\Services\Vawc\OnlineReports.
 *
 * Checked here whatever the page did: a request sent straight to this
 * address with no card, a revoked card, or a man's card is refused. Nobody
 * is added to or changed on the register by anything here, and the register
 * is not searched from here — the VAW Desk does that when it verifies.
 */
class VawcReportController extends BaseController
{
    public function store(FileOnlineReportRequest $request, ResidentCards $cards, OnlineReports $reports)
    {
        $data = $request->validated();

        $check = $cards->verify($data['resident_card_code']);
        if ($check['ok'] && ($refusal = VawcComplainant::onlineRefusal($check['resident']))) {
            $check = ['ok' => false, 'message' => $refusal];
        }
        if (! $check['ok']) {
            return $this->error($check['message'], 422, ['resident_card_code' => [$check['message']]]);
        }

        $report = $reports->file($data, $check['resident'], $check['card'], OnlineReport::VIA_PUBLIC, $request->file('valid_id'));

        return $this->success([
            'reference_no' => $report->reference_no,
            'status' => $report->status,
            'visit_required' => $report->visit_required,
        ], 'Your complaint was received as ' . $report->reference_no . '. ' . OnlineReports::nextStep($report), 201);
    }
}
