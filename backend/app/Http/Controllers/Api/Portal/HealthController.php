<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Health\ImmunizationRecord;
use App\Models\Health\Visit;

/**
 * A resident reading their OWN health record. Read only, and only their own.
 *
 * VIEW ONLY IS THE WHOLE POINT. A health record is written at the station by
 * the person who took the reading; the patient reading theirs is right, the
 * patient editing it is not. There is no store, no update and no destroy
 * here, so there is nothing to forget to guard.
 *
 * WHOSE RECORD: the one linked to the signed-in account, taken from the
 * session and never from the request. A resident id in the URL would be an
 * invitation to change it and read the neighbour's.
 *
 * WHAT IS LEFT OUT, and deliberately:
 *
 *   - the consultation NOTES and observations. What a midwife wrote down
 *     about somebody is her clinical note, and a patient reading a half-
 *     sentence out of context at home cannot ask her what she meant.
 *   - referral destinations and reasons.
 *   - anything from the VAWC desk, which does not appear in health records
 *     at all and never will.
 *
 * What is here is what a person legitimately asks the station for: when did
 * I come in, what were my readings, and which vaccines have my children had.
 */
class HealthController extends PortalController
{
    public function show()
    {
        $residentId = $this->residentId();

        if (! $residentId) {
            return $this->notFound('No resident record is linked to your account');
        }

        $visits = Visit::where('patient_id', $residentId)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($v) => [
                'visit_date' => $v->visit_date?->toDateString(),
                'visit_time' => $v->visit_time,
                'visit_reason' => $v->visit_reason,
                /* The readings, which are facts about their own body. */
                'blood_pressure' => $v->blood_pressure,
                'temperature' => $v->temperature,
                'heart_rate' => $v->heart_rate,
                'respiratory_rate' => $v->respiratory_rate,
                'oxygen_saturation' => $v->oxygen_saturation,
                'height_cm' => $v->height_cm,
                'weight_kg' => $v->weight_kg,
                /* Advice was given TO them, so it is theirs to re-read. The
                   clinical notes beside it were not, and are not sent. */
                'treatment_advice' => $v->treatment_advice,
                'followup_schedule' => $v->followup_schedule?->toDateString(),
            ]);

        $immunizations = ImmunizationRecord::where('child_id', $residentId)
            ->orderByDesc('vaccination_date')
            ->limit(50)
            ->get()
            ->map(fn ($i) => [
                'vaccine_name' => $i->vaccine_name,
                'vaccination_date' => $i->vaccination_date?->toDateString(),
                'status' => $i->status,
                /* Not the lot number: that is the station's stock record,
                   and it identifies a batch rather than a person. */
            ]);

        return $this->success([
            'visits' => $visits,
            'immunizations' => $immunizations,
            'note' => 'This is a copy of what the health station holds for you. '
                . 'To correct anything on it, or to ask about a consultation, '
                . 'visit the station — records are changed there, not here.',
        ], 'Your health record retrieved');
    }
}
