<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ChildRecord;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Models\Health\Visit;
use App\Models\Resident\Resident;
use App\Services\Health\BarangayMonthlyReport;
use App\Services\Health\HealthReports;
use App\Support\ManilaTime;
use App\Support\Xlsx;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The station's figures: coverage against the population, the dashboard's
 * record counts, and the monthly and yearly reports.
 */
class ReportController extends BaseController
{
    public function coverage(Request $request)
    {
        /* Manila's year: on New Year's morning the server's clock is still
           in the old one until 8. */
        $year = $request->input('year', substr(ManilaTime::today(), 0, 4));

        /*
         * The denominator of every coverage figure below. Counting
         * relatives who live in other towns understates immunisation and
         * prenatal coverage against a population the station never serves.
         */
        $residents = Resident::bonafide()->where('is_active', true)->count();
        $healthVisits = Visit::whereYear('visit_date', $year)->count();
        $immunized = ImmunizationRecord::whereYear('vaccination_date', $year)
            ->where('status', 'Completed')
            ->distinct('child_id')
            ->count('child_id');
        $prenatalCare = MaternalRecord::whereYear('pregnancy_registration_date', $year)->count();

        return $this->success([
            'year' => $year,
            'total_population' => $residents,
            'health_visit_coverage' => $residents > 0 ? round(($healthVisits / $residents) * 100, 2) : 0,
            'immunization_coverage' => $residents > 0 ? round(($immunized / $residents) * 100, 2) : 0,
            'prenatal_care_coverage' => $residents > 0 ? round(($prenatalCare / $residents) * 100, 2) : 0,
            'total_visits' => $healthVisits,
            'total_immunized' => $immunized,
            'total_prenatal' => $prenatalCare,
        ], 'Health coverage report retrieved');
    }

    /**
     * The dashboard's record counts — every one a COUNT of rows, by each
     * record's own date, in Manila's month and year.
     *
     * "Current prenatal visits" is the prenatal records of the pregnancies
     * that are current right now: a completed pregnancy's visits are hers
     * still, but no longer current.
     */
    public function summary()
    {
        $today = Carbon::parse(ManilaTime::today());
        $year = $today->year;
        $month = $today->month;

        return $this->success([
            'year' => $year,
            'month' => $month,
            'child_records' => ChildRecord::count(),
            'child_records_this_year' => ChildRecord::whereYear('record_date', $year)->count(),
            'maternal_records' => MaternalRecord::count(),
            'maternal_records_this_year' => MaternalRecord::whereYear('pregnancy_registration_date', $year)->count(),
            'active_pregnancies' => MaternalRecord::active()->count(),
            'current_prenatal_visits' => PrenatalVisit::whereHas('pregnancy', fn ($q) => $q->active())->count(),
            'prenatal_records_this_month' => PrenatalVisit::whereYear('visit_date', $year)->whereMonth('visit_date', $month)->count(),
            'prenatal_records_this_year' => PrenatalVisit::whereYear('visit_date', $year)->count(),
        ], 'Health records summary retrieved');
    }

    /**
     * The "BARANGAY MONTHLY REPORT" form's figures for one month — see
     * BarangayMonthlyReport. The page writes them onto the form's lines, and
     * the station may correct them before printing.
     */
    public function barangayMonthly(Request $request, BarangayMonthlyReport $report)
    {
        $validated = $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        return $this->success(
            $report->build((int) $validated['year'], (int) $validated['month'])
                + ['submitted_by' => auth()->user()?->name],
            'Barangay monthly report retrieved'
        );
    }

    /**
     * A monthly or yearly report — on the page, or downloaded as CSV or
     * Excel. The file is the same report the page shows (HealthReports).
     */
    public function report(Request $request, string $kind, HealthReports $reports)
    {
        abort_unless(in_array($kind, HealthReports::KINDS, true), 404);

        $data = $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
            'zone_purok' => 'nullable|string|max:60',
            'format' => ['nullable', Rule::in(['json', 'csv', 'xlsx'])],
        ]);

        $report = $reports->build($kind, (int) $data['year'],
            isset($data['month']) ? (int) $data['month'] : null, $data['zone_purok'] ?? null);

        $format = $data['format'] ?? 'json';
        if ($format === 'json') {
            return $this->success($report, 'Report generated');
        }

        $rows = $reports->sheet($report);
        $stem = str($report['title'] . ' ' . $report['period_label'] . ($report['zone_purok'] ? ' ' . $report['zone_purok'] : ''))
            ->slug()->toString();

        if ($format === 'xlsx') {
            return response()->stream(function () use ($rows, $report) {
                Xlsx::write(array_shift($rows), function (callable $row) use ($rows) {
                    foreach ($rows as $cells) {
                        $row($cells);
                    }
                }, $report['period'] === 'monthly' ? 'Monthly' : 'Annual');
            }, 200, [
                'Content-Type' => Xlsx::CONTENT_TYPE,
                'Content-Disposition' => 'attachment; filename="' . $stem . '.xlsx"',
                'Cache-Control' => 'no-store',
            ]);
        }

        return response()->stream(function () use ($rows) {
            $out = fopen('php://output', 'wb');
            /* A UTF-8 BOM, for Excel: without it "Peña" opens as "PeÃ±a". */
            fwrite($out, "\xEF\xBB\xBF");
            foreach ($rows as $cells) {
                fputcsv($out, $cells);
            }
            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $stem . '.csv"',
            'Cache-Control' => 'no-store',
        ]);
    }
}
