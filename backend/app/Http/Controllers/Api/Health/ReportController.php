<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\Visit;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;

/**
 * Coverage against the barangay's own population.
 */
class ReportController extends BaseController
{
    public function coverage(Request $request)
    {
        $year = $request->input('year', date('Y'));

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
}
