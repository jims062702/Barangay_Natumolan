<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Settlement;
use Illuminate\Http\Request;

/**
 * What the Lupon secretary reads rather than records: the deadline alerts,
 * the data behind the prescribed KP forms, and the monthly transmittal.
 */
class ReportController extends BaseController
{
    /**
     * Dashboard alerts: upcoming hearings + settlements still inside the
     * 10-day repudiation window (lapsed ones are auto-finalized here).
     */
    public function deadlines()
    {
        Settlement::finaliseLapsedRepudiations();

        return $this->success([
            'upcoming_hearings' => Hearing::with(CaseFile::WITH_PARTIES)
                ->where('status', 'Scheduled')
                ->where('scheduled_at', '>=', now())
                ->orderBy('scheduled_at')
                ->limit(10)
                ->get(),
            'repudiation_window' => Settlement::with(CaseFile::WITH_PARTIES)
                ->where('status', 'Within Repudiation Period')
                ->orderBy('repudiation_deadline')
                ->get(),
            'pending_compliance' => Settlement::with(CaseFile::WITH_PARTIES)
                ->whereIn('status', ['Final', 'Not Complied'])
                ->whereNotNull('compliance_deadline')
                ->orderBy('compliance_deadline')
                ->get(),
        ], 'Lupon deadlines retrieved');
    }

    /**
     * Structured payloads for the prescribed KP forms (rendered/printed
     * by the frontend).
     */
    public function forms(CaseFile $case)
    {
        $case->load(['complaint', 'complainant', 'respondents', 'settlement', 'hearings']);

        $nextHearing = $case->hearings
            ->where('status', 'Scheduled')
            ->sortBy('scheduled_at')
            ->first();
        $settlement = $case->settlement;

        // `available` tells the UI which prescribed forms this case has the
        // facts to produce — a settlement form needs a settlement on file.
        return $this->success([
            'case' => $case,
            'barangay' => [
                'name' => 'Barangay Natumolan',
                'municipality' => 'Tagoloan',
                'province' => 'Misamis Oriental',
            ],
            'next_hearing' => $nextHearing,
            'forms' => [
                [
                    'code' => 'KP-7',
                    'name' => 'Notice of Hearing (Mediation)',
                    'available' => (bool) $nextHearing,
                    'requires' => 'a scheduled hearing',
                ],
                [
                    'code' => 'KP-9',
                    'name' => 'Summons',
                    'available' => (bool) $nextHearing,
                    'requires' => 'a scheduled hearing',
                ],
                [
                    'code' => 'KP-16',
                    'name' => 'Amicable Settlement',
                    'available' => $settlement?->settlement_type === 'Amicable Settlement',
                    'requires' => 'a recorded amicable settlement',
                ],
                [
                    'code' => 'KP-18',
                    'name' => 'Arbitration Award',
                    'available' => $settlement?->settlement_type === 'Arbitration Award',
                    'requires' => 'a recorded arbitration award',
                ],
                [
                    'code' => 'KP-20',
                    'name' => 'Certificate to File Action',
                    'available' => (bool) $settlement?->cfa_issued,
                    'requires' => 'a Certificate to File Action to have been issued',
                ],
                [
                    'code' => 'KP-21',
                    'name' => 'Certificate to Bar Action',
                    'available' => (bool) $settlement?->cba_issued,
                    'requires' => 'a Certificate to Bar Action to have been issued',
                ],
            ],
        ], 'KP form data generated');
    }

    public function monthlyTransmittal(Request $request)
    {
        $month = $request->input('month', date('m'));
        $year = $request->input('year', date('Y'));

        $cases = CaseFile::whereMonth('date_filed', $month)
            ->whereYear('date_filed', $year)
            ->get();

        return $this->success([
            'month' => $month,
            'year' => $year,
            'cases_filed' => $cases->count(),
            'cases_settled' => $cases->where('current_stage', 'Settled')->count(),
            'cases_dismissed' => $cases->where('current_stage', 'Dismissed')->count(),
            'cases_referred' => $cases->where('current_stage', 'Referred')->count(),
            'hearings_held' => Hearing::whereMonth('scheduled_at', $month)
                ->whereYear('scheduled_at', $year)
                ->where('status', 'Completed')
                ->count(),
            'settlement_rate' => $cases->count() > 0
                ? round(($cases->where('current_stage', 'Settled')->count() / $cases->count()) * 100, 2)
                : 0,
        ], 'Monthly transmittal report generated');
    }
}
