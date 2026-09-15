<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\Document;
use App\Models\Vawc\Followup;
use App\Models\Vawc\Incident;
use App\Models\Vawc\Referral;
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
            'cases_by_violence_type' => CaseFile::whereYear('report_date', $year)
                ->groupBy('violence_type')
                ->selectRaw('violence_type, count(*) as count')
                ->get(),
            'referrals_made' => Referral::whereYear('referral_date', $year)->count(),
            'referrals_acknowledged' => Referral::whereYear('referral_date', $year)
                ->whereNotNull('acknowledgment_date')->count(),
            'cases_with_children' => CaseFile::where('children_involved', true)->whereYear('report_date', $year)->count(),
            'pending_followups' => Followup::whereDate('next_followup_date', '>=', today())->count(),
            'overdue_followups' => $latestOnActive
                ->filter(fn ($f) => $f->next_followup_date && $f->next_followup_date->isPast())
                ->count(),
            'protection_orders_issued' => Incident::where('protection_order_filed', true)
                ->whereYear('created_at', $year)->count(),
            'documents_on_file' => Document::whereYear('created_at', $year)->count(),
            'closure_recommended' => $latestOnActive->where('closure_recommended', true)->count(),
            // Anonymized service picture across open cases.
            'safety_status' => $latestOnActive->groupBy('safety_status')->map->count(),
            'bpo_compliance' => $latestOnActive->groupBy('bpo_compliance')->map->count(),
            'average_response_days' => $this->averageResponseDays($year),
        ], 'VAWC statistics retrieved');
    }

    /**
     * Service response time: days from intake to the first protective action
     * taken on the case (a referral or a follow-up visit, whichever came
     * first). Cases with no action yet are excluded so one untouched case
     * cannot masquerade as a fast average.
     */
    private function averageResponseDays(string|int $year): float
    {
        $cases = CaseFile::whereYear('report_date', $year)
            ->with(['referrals:id,vawc_case_id,referral_date', 'followups:id,vawc_case_id,followup_date'])
            ->get();

        $spans = $cases->map(function ($case) {
            $first = collect([
                $case->referrals->min('referral_date'),
                $case->followups->min('followup_date'),
            ])->filter()->min();

            return $first ? $case->report_date->diffInDays($first) : null;
        })->filter(fn ($days) => $days !== null);

        return $spans->isEmpty() ? 0 : round($spans->avg(), 1);
    }
}
