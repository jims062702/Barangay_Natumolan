<?php

namespace App\Services\Lupon;

use App\Models\Lupon\CaseFile;
use Carbon\Carbon;

/**
 * The Monthly Transmittal of Final Reports — the Lupon's report to the court,
 * copied to the DILG and the PNP — one row per case filed in the month.
 *
 * Laid out the way the barangay's own sheet is: a "/" in the cell that
 * applies, a number in the TOTAL row.
 *
 *   Nature of case    Crim. · Civil · Others
 *   Action taken      Med. (settled at mediation) · Conci (settled at
 *                     conciliation) · Arbit · Repu (settlement repudiated) ·
 *                     Cert. (certified to file action) · Cancel (the
 *                     complaint was withdrawn) · Dropped (dismissed) ·
 *                     On-going
 *
 * Arbit is on the form and stays on it, but nothing here ever fills it: this
 * Lupon mediates and conciliates, and makes no arbitration awards. A referred
 * case gets no action mark — it was not acted on here — and says so in
 * Remarks.
 */
final class MonthlyTransmittal
{
    /** The kind of each classification, as the sheet sorts them. */
    public const NATURE = [
        'Assault' => 'crim',
        'Theft' => 'crim',
        'Libel' => 'crim',
        'Property Damage' => 'civil',
        'Ejectment' => 'civil',
        'Debt' => 'civil',
        'Land Dispute' => 'civil',
        'Family Dispute' => 'others',
        'Others' => 'others',
    ];

    public const NATURES = ['crim', 'civil', 'others'];

    public const ACTIONS = ['med', 'conci', 'arbit', 'repu', 'cert', 'cancel', 'dropped', 'ongoing'];

    public function build(int $year, int $month): array
    {
        $start = Carbon::create($year, $month, 1);

        $cases = CaseFile::with(['complainant', 'respondents', 'hearings', 'settlement'])
            ->whereYear('date_filed', $year)
            ->whereMonth('date_filed', $month)
            ->orderBy('date_filed')
            ->orderBy('id')
            ->get();

        $rows = $cases->map(function (CaseFile $case) {
            $nature = self::NATURE[$case->case_classification] ?? 'others';
            $action = $this->actionOf($case);

            return [
                'case_number' => $case->case_number,
                'complainant' => mb_strtoupper(trim((string) ($case->complainant?->full_name ?: $case->complainant_name))),
                'respondents' => mb_strtoupper($case->respondents->map(fn ($r) => trim((string) $r->full_name))->filter()->join('/ ')),
                'nature' => $nature,
                'title' => mb_strtoupper(trim((string) $case->case_title)),
                'action' => $action,
                /* The words that go with an end the form only counts. */
                'remarks' => $case->current_stage === 'Referred'
                    ? 'Referred'
                    : (string) ($case->closure_reason ?? ''),
            ];
        })->values();

        $totals = ['cases' => $rows->count(), 'nature_total' => $rows->count(), 'action_total' => $rows->whereNotNull('action')->count()];
        foreach (self::NATURES as $n) {
            $totals[$n] = $rows->where('nature', $n)->count();
        }
        foreach (self::ACTIONS as $a) {
            $totals[$a] = $rows->where('action', $a)->count();
        }

        return [
            /* "August 1-31, 2026", as the office writes the reporting month. */
            'reporting_month' => $start->format('F') . ' 1-' . $start->daysInMonth . ', ' . $year,
            'rows' => $rows,
            'totals' => $totals,
        ];
    }

    /** Where the case stands, in the sheet's terms. */
    private function actionOf(CaseFile $case): ?string
    {
        /* A repudiated settlement is the action taken, even though the case
           has since gone back to conciliation. */
        if ($case->settlement?->status === 'Repudiated') {
            return 'repu';
        }

        return match ($case->current_stage) {
            /* Settled before the Punong Barangay, unless it reached the Lupon. */
            'Settled' => $case->hearings->contains('hearing_type', 'Conciliation') ? 'conci' : 'med',
            'Dismissed' => 'dropped',
            /* The complainant took it back: cancelled, in the form's word. */
            'Withdrawn' => 'cancel',
            'CFA' => 'cert',
            'Referred' => null,
            default => 'ongoing',
        };
    }
}
