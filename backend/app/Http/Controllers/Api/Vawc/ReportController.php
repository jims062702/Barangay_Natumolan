<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Document;
use App\Models\Vawc\Followup;
use App\Models\Vawc\ProtectionOrder;
use App\Models\Vawc\Referral;
use App\Services\Vawc\DeskForms;
use App\Support\ManilaTime;
use App\Support\Signatories;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Anonymized statistics — the ONLY VAWC data other dashboards may consume.
 */
class ReportController extends BaseController
{
    /**
     * Anonymized statistics — this is the ONLY VAWC data other dashboards
     * may consume (no personally identifiable survivor information).
     */
    public function statistics(Request $request)
    {
        $year = $request->input('year', date('Y'));

        // Current safety picture = the LATEST follow-up on each case, not
        // every visit ever recorded (older visits describe a past state).
        $latestIds = Followup::selectRaw('MAX(id) as id')->groupBy('vawc_case_id')->pluck('id');
        $latest = Followup::whereIn('id', $latestIds)
            ->with('vawcCase:id,status')
            ->get();
        $latestOnActive = $latest->filter(fn ($f) => $f->vawcCase?->status === 'Active');

        return $this->success([
            'total_cases_active' => CaseFile::where('status', 'Active')->count(),
            'total_cases_year' => CaseFile::whereYear('report_date', $year)->count(),
            /*
             * COUNTED PER KIND, so a case that is two kinds is counted in
             * both — which is the honest figure and the one the return
             * asks for.
             *
             * Grouping on the single column put every such case under
             * "Mixed": a beating with threats and wages withheld showed as
             * one Mixed case and nothing under Physical, Psychological or
             * Economic, so the barangay under-reported all three at once.
             */
            'cases_by_violence_type' => $this->byViolenceType($year),
            'referrals_made' => Referral::whereYear('referral_date', $year)->count(),
            /* Taken up by the receiving office: accepted, in progress or done. */
            'referrals_acknowledged' => Referral::whereYear('referral_date', $year)
                ->whereIn('referral_status', Referral::ACKNOWLEDGED)->count(),
            'cases_with_children' => CaseFile::where('children_involved', true)->whereYear('report_date', $year)->count(),
            'pending_followups' => Followup::whereDate('next_followup_date', '>=', today())->count(),
            'overdue_followups' => $latestOnActive
                ->filter(fn ($f) => $f->next_followup_date && $f->next_followup_date->isPast())
                ->count(),
            /* Every issuance counts, renewals included — each is its own BPO. */
            'protection_orders_issued' => ProtectionOrder::where('status', 'Issued')
                ->whereYear('issued_on', $year)->count(),
            /* In effect today, Manila's today: issued, and within its fifteen days. */
            'protection_orders_in_effect' => ProtectionOrder::where('status', 'Issued')
                ->whereDate('issued_on', '<=', ManilaTime::today())
                ->whereDate('expires_on', '>=', ManilaTime::today())
                ->whereHas('vawcCase', fn ($q) => $q->where('status', 'Active'))
                ->count(),
            'documents_on_file' => Document::whereYear('created_at', $year)->count(),
            'closure_recommended' => $latestOnActive->where('closure_recommended', true)->count(),
            // Anonymized service picture across open cases.
            'safety_status' => $latestOnActive->groupBy('safety_status')->map->count(),
            'protection_order_status' => $latestOnActive->groupBy('protection_order_status')->map->count(),
            'average_response_days' => $this->averageResponseDays($year),
        ], 'VAWC statistics retrieved');
    }

    /**
     * How many cases of each kind this year, a case counted once per kind.
     *
     * Read in PHP rather than grouped in SQL: the kinds are a JSON list, and
     * a GROUP BY over it would either need a JSON table function this
     * MariaDB does not have or a join table for what is a handful of rows.
     */
    private function byViolenceType(int $year): array
    {
        $counts = [];

        foreach (CaseFile::whereYear('report_date', $year)->get(['violence_type', 'violence_types']) as $case) {
            /* A case filed before the list existed still says one kind. */
            $kinds = $case->violence_types ?: array_filter([$case->violence_type]);

            foreach ($kinds as $kind) {
                $counts[$kind] = ($counts[$kind] ?? 0) + 1;
            }
        }

        arsort($counts);

        return array_map(
            fn ($kind, $count) => ['violence_type' => $kind, 'count' => $count],
            array_keys($counts),
            $counts
        );
    }

    /**
     * The VAW-C Cases report — a quarter, or the year's summary.
     *
     * It carries NAMES, so it is drawn up only when asked for (never on a
     * timer), and every case on it gets a line in its access trail.
     */
    public function casesReport(Request $request, DeskForms $forms)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'between:2000,2100'],
            'period' => ['required', 'regex:/^(q[1-4]|year)$/'],
        ]);

        return $this->success(
            $forms->casesReport((int) $validated['year'], $validated['period']) + ['signatories' => Signatories::all()],
            'VAW-C cases report drawn up'
        );
    }

    /** VAW Form 1 — the Barangay Data Capture Form. Case codes and counts only. */
    public function dataCapture(Request $request, DeskForms $forms)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'between:2000,2100'],
            'period' => ['required', 'regex:/^(m(1[0-2]|[1-9])|q[1-4]|year)$/'],
        ]);

        return $this->success(
            $forms->dataCapture((int) $validated['year'], $validated['period']) + ['signatories' => Signatories::all()],
            'VAW Form 1 drawn up'
        );
    }

    /**
     * The Barangay VAW Report — Annual Accomplishment Report, January to
     * December. Counts only: no names, no case codes, so nothing is written
     * to any case's access trail.
     */
    public function annual(Request $request, DeskForms $forms)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        return $this->success(
            $forms->annual((int) $validated['year']) + ['signatories' => Signatories::all()],
            'VAW annual accomplishment report drawn up'
        );
    }

    /**
     * Service response time: days from intake to the first protective action
     * taken on the case (a BPO applied for or issued, a referral, or a
     * follow-up, whichever came first). Cases with no action yet are excluded
     * so one untouched case cannot masquerade as a fast average.
     *
     * Counted in whole Manila days: a complaint taken at 9 PM and referred
     * the next morning was answered in one day, not in 0.5.
     */
    private function averageResponseDays(string|int $year): float
    {
        $cases = CaseFile::whereYear('report_date', $year)
            ->with([
                'referrals:id,vawc_case_id,referral_date',
                'followups:id,vawc_case_id,followup_date',
                'protectionOrders:id,vawc_case_id,applied_on,issued_on',
            ])
            ->get();

        $spans = $cases->map(function ($case) {
            $first = collect([
                $case->referrals->min('referral_date'),
                $case->followups->min('followup_date'),
                $case->protectionOrders->min('applied_on'),
                $case->protectionOrders->min('issued_on'),
            ])->filter()->map(fn ($date) => $date->toDateString())->min();

            if (! $first) {
                return null;
            }

            $reported = $case->report_date->copy()->setTimezone(ManilaTime::ZONE)->startOfDay();

            return max(0, (int) round($reported->diffInDays(Carbon::parse($first, ManilaTime::ZONE)->startOfDay())));
        })->filter(fn ($days) => $days !== null);

        return $spans->isEmpty() ? 0 : round($spans->avg(), 1);
    }
}
