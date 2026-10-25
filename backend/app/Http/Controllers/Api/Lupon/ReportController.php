<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Settlement;
use App\Services\Lupon\MonthlyTransmittal;
use App\Support\ManilaTime;
use App\Support\Signatories;
use Carbon\Carbon;
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
        /*
         * The households come with the parties because a summons has to say
         * WHERE to serve it. A resident's address is their household's — the
         * case itself only carries one for somebody living outside the
         * barangay — so without these the paper names a person and no place.
         */
        $case->load([
            'complaint',
            'complainant.household',
            'respondents.household',
            'settlement',
            'hearings',
        ]);

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
            /*
             * Who signs the paper. The Lupon Chairman IS the Punong Barangay
             * under the KP law, so the roster answers both names on a
             * summons; the Secretary attests it.
             */
            'signatories' => Signatories::all(),
            'forms' => [
                [
                    'code' => 'KP-7',
                    /* Not "(Mediation)": the same notice is issued again for
                       the Lupon's own sittings, and the sheet names whichever
                       forum the hearing belongs to. */
                    'name' => 'Notice of Hearing — for the complainant',
                    'available' => (bool) $nextHearing,
                    'requires' => 'a scheduled hearing',
                ],
                [
                    'code' => 'KP-9',
                    /* Two papers, two people: the complainant is notified of
                       a hearing, the respondent is summoned to answer. */
                    'name' => 'Summons — for the respondent',
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
                    'code' => 'KP-20-B',
                    'name' => 'Certification to File Action (KP Form 20-B)',
                    'available' => $case->current_stage === 'CFA' || ($case->current_stage === 'Conciliation' && $case->hearings()->where('hearing_type', 'Conciliation')->where('status', 'Completed')->count() >= 3),
                    'requires' => 'conciliation to be completed without settlement or case certified to court',
                ],
            ],
        ], 'KP form data generated');
    }

    /**
     * Consolidated Cases Filed — every case filed in the month, what it is
     * about and where it ended up.
     *
     * The transmittal below is the court's form and says only what the court
     * asks. This is the barangay's own list: the title of each complaint and
     * its status in words, which is what the office is asked for when
     * somebody wants to know what the Lupon did this month.
     */
    public function casesFiled(Request $request)
    {
        $request->validate([
            'month' => ['nullable', 'integer', 'between:1,12'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'stage' => ['nullable', 'string'],
        ]);

        $now = Carbon::now(ManilaTime::ZONE);
        $month = (int) $request->input('month', $now->month);
        $year = (int) $request->input('year', $now->year);
        $stage = $request->input('stage');

        $cases = CaseFile::with(['complainant:id,first_name,middle_name,last_name', 'respondents:id,first_name,middle_name,last_name'])
            ->whereYear('date_filed', $year)
            ->whereMonth('date_filed', $month)
            ->when($stage, fn ($q) => $q->where('current_stage', $stage))
            ->orderBy('date_filed')
            ->orderBy('id')
            ->get();

        $start = Carbon::create($year, $month, 1);

        return $this->success([
            'period' => $start->format('F') . ' 1-' . $start->daysInMonth . ', ' . $year,
            'stage' => $stage,
            'rows' => $cases->map(fn (CaseFile $case) => [
                'case_number' => $case->case_number,
                'title' => $case->case_title,
                'classification' => $case->case_classification,
                'complainant' => $case->complainant_display_name,
                'respondents' => $case->respondent_display_names,
                'date_filed' => $case->date_filed?->toDateString(),
                'status' => $case->current_stage,
                'date_resolved' => $case->date_resolved?->toDateString(),
                'remarks' => $case->closure_reason,
            ])->values(),
            /* Every stage counted, including the ones with none: a report
               that simply omits "Withdrawn: 0" reads as "not asked". */
            'totals' => collect(['Filed', 'Mediation', 'Conciliation', 'Settled', 'Withdrawn', 'CFA', 'Dismissed', 'Referred', CaseFile::CLOSED_UNPAID])
                ->mapWithKeys(fn (string $name) => [$name => $cases->where('current_stage', $name)->count()])
                ->all(),
            'total' => $cases->count(),
            'signatories' => Signatories::all(),
        ], 'Consolidated cases filed retrieved');
    }

    public function monthlyTransmittal(Request $request, MonthlyTransmittal $transmittal)
    {
        $request->validate([
            'month' => ['nullable', 'integer', 'between:1,12'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
        ]);

        /* This month in Manila, when none is asked for. */
        $now = Carbon::now(ManilaTime::ZONE);
        $month = (int) $request->input('month', $now->month);
        $year = (int) $request->input('year', $now->year);

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
            /* The form itself: the rows, the totals, and who signs it. */
            'transmittal' => $transmittal->build($year, $month),
            'signatories' => Signatories::all(),
        ], 'Monthly transmittal report generated');
    }
}
