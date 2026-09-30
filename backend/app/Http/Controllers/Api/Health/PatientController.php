<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ChildRecord;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\Visit;
use App\Models\Resident\Resident;

/**
 * Everything the station holds on one person, in one place.
 */
class PatientController extends BaseController
{
    public function history(Resident $resident)
    {
        return $this->success([
            'resident_id' => $resident->id,
            'resident_name' => $resident->full_name,
            'visits' => Visit::where('patient_id', $resident->id)
                ->orderBy('visit_date', 'desc')
                ->limit(10)
                ->get(),
            'immunizations' => ImmunizationRecord::where('child_id', $resident->id)
                ->orderBy('vaccination_date', 'desc')
                ->limit(10)
                ->get(),
            /* Every pregnancy and every weighing, newest first — there used
               to be one of each, which is why this said ->first(). */
            'maternal_health' => MaternalRecord::where('mother_id', $resident->id)
                ->withCount('prenatalVisits')
                ->orderByDesc('pregnancy_registration_date')
                ->orderByDesc('id')
                ->get(),
            'child_health' => ChildRecord::where('child_id', $resident->id)
                ->orderByDesc('record_date')
                ->orderByDesc('id')
                ->get(),
        ], 'Patient history retrieved');
    }
}
