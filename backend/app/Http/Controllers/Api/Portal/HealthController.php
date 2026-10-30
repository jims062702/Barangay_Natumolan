<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Health\ChildRecord;
use App\Models\Health\ImmunizationProfile;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Models\Health\SeniorCheck;
use App\Models\Health\Visit;
use App\Models\Resident\Resident;

/**
 * A resident reading their OWN health record. Read only, and only their own.
 *
 * Includes general consultations, prenatal checkups, maternal health records,
 * senior citizen checkups, and child health/growth monitoring records.
 */
class HealthController extends PortalController
{
    public function show()
    {
        $residentId = $this->residentId();

        if (! $residentId) {
            return $this->notFound('No resident record is linked to your account');
        }

        $generalVisits = Visit::where('patient_id', $residentId)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($v) => [
                'type' => 'General Consultation',
                'visit_date' => $v->visit_date?->toDateString(),
                'visit_time' => $v->visit_time,
                'visit_reason' => $v->visit_reason,
                'blood_pressure' => $v->blood_pressure,
                'temperature' => $v->temperature,
                'heart_rate' => $v->heart_rate,
                'respiratory_rate' => $v->respiratory_rate,
                'oxygen_saturation' => $v->oxygen_saturation,
                'height_cm' => $v->height_cm,
                'weight_kg' => $v->weight_kg,
                'treatment_advice' => $v->treatment_advice,
                'followup_schedule' => $v->followup_schedule?->toDateString(),
            ]);

        $prenatalVisits = PrenatalVisit::where('mother_id', $residentId)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($pv) => [
                'type' => 'Prenatal Checkup',
                'visit_date' => $pv->visit_date?->toDateString(),
                'visit_time' => null,
                'visit_reason' => 'Prenatal Checkup' . ($pv->months_of_pregnancy ? " ({$pv->months_of_pregnancy})" : ''),
                'blood_pressure' => $pv->blood_pressure,
                'temperature' => null,
                'heart_rate' => null,
                'respiratory_rate' => null,
                'oxygen_saturation' => null,
                'height_cm' => $pv->height_cm ? (string) $pv->height_cm : null,
                'weight_kg' => $pv->weight_kg ? (string) $pv->weight_kg : null,
                'treatment_advice' => $pv->edc ? 'Expected Delivery: ' . $pv->edc->toDateString() : ($pv->complaint ?: null),
                'followup_schedule' => null,
            ]);

        $seniorChecks = SeniorCheck::where('senior_id', $residentId)
            ->orderByDesc('check_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($sc) => [
                'type' => 'Senior BP Checkup',
                'visit_date' => $sc->check_date?->toDateString(),
                'visit_time' => null,
                'visit_reason' => 'Senior Citizen BP Checkup',
                'blood_pressure' => $sc->blood_pressure,
                'temperature' => null,
                'heart_rate' => null,
                'respiratory_rate' => null,
                'oxygen_saturation' => null,
                'height_cm' => null,
                'weight_kg' => null,
                'treatment_advice' => $sc->notes ?: null,
                'followup_schedule' => null,
            ]);

        $childVisits = ChildRecord::where('child_id', $residentId)
            ->orderByDesc('record_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($cr) => [
                'type' => 'Child Health Checkup',
                'visit_date' => $cr->record_date?->toDateString(),
                'visit_time' => null,
                'visit_reason' => 'Child Health & Growth Checkup' . ($cr->nutritional_status ? " ({$cr->nutritional_status})" : ''),
                'blood_pressure' => null,
                'temperature' => null,
                'heart_rate' => null,
                'respiratory_rate' => null,
                'oxygen_saturation' => null,
                'height_cm' => $cr->current_height ? (string) $cr->current_height : null,
                'weight_kg' => $cr->current_weight ? (string) $cr->current_weight : null,
                'treatment_advice' => $cr->feeding_counseling_notes ?: ($cr->growth_monitoring_notes ?: null),
                'followup_schedule' => null,
            ]);

        $visits = $generalVisits
            ->concat($prenatalVisits)
            ->concat($seniorChecks)
            ->concat($childVisits)
            ->sortByDesc(fn ($v) => $v['visit_date'] ?? '')
            ->values();

        $maternalRecords = MaternalRecord::where('mother_id', $residentId)
            ->withCount('prenatalVisits')
            ->orderByDesc('pregnancy_registration_date')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'status' => $m->status,
                'pregnancy_registration_date' => $m->pregnancy_registration_date?->toDateString(),
                'lmp' => $m->lmp?->toDateString(),
                'expected_delivery_date' => $m->expected_delivery_date?->toDateString(),
                'actual_delivery_date' => $m->actual_delivery_date?->toDateString(),
                'risk_indicators' => $m->risk_indicators,
                'maternal_immunization_received' => (bool) $m->maternal_immunization_received,
                'post_natal_followup_required' => (bool) $m->post_natal_followup_required,
                'family_planning_method' => $m->family_planning_method,
                'prenatal_visits_count' => $m->prenatal_visits_count,
            ]);

        $childRecords = ChildRecord::where('child_id', $residentId)
            ->orderByDesc('record_date')
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'record_date' => $c->record_date?->toDateString(),
                'current_weight' => $c->current_weight,
                'current_height' => $c->current_height,
                'nutritional_status' => $c->nutritional_status,
                'fully_immunized_status' => $c->fully_immunized_status,
                'breastfeeding_status' => $c->breastfeeding_status,
                'vitamin_services_received' => (bool) $c->vitamin_services_received,
            ]);

        $childIds = [$residentId];
        $myResident = Resident::find($residentId);
        if ($myResident && $myResident->household_id) {
            $householdChildIds = Resident::where('household_id', $myResident->household_id)
                ->where('id', '!=', $residentId)
                ->where('birthdate', '>=', now()->subYears(18))
                ->pluck('id')
                ->toArray();
            $childIds = array_merge($childIds, $householdChildIds);
        }

        $immunizationRecords = ImmunizationRecord::whereIn('child_id', $childIds)
            ->with('child:id,first_name,last_name')
            ->orderByDesc('vaccination_date')
            ->limit(50)
            ->get();

        $profiles = ImmunizationProfile::whereIn('resident_id', $childIds)
            ->with('resident:id,first_name,last_name')
            ->get();

        $immunizationList = collect();
        foreach ($immunizationRecords as $i) {
            $immunizationList->push([
                'child_name' => $i->child_id !== $residentId && $i->child ? $i->child->full_name : null,
                'vaccine_name' => $i->vaccine_name . ($i->notes ? " ({$i->notes})" : ''),
                'vaccination_date' => $i->vaccination_date?->toDateString(),
                'status' => $i->status,
            ]);
        }

        foreach ($profiles as $p) {
            $childName = $p->resident_id !== $residentId && $p->resident ? $p->resident->full_name : null;
            if ($p->booster && !$immunizationRecords->where('child_id', $p->resident_id)->contains('vaccine_name', 'COVID booster')) {
                $immunizationList->push([
                    'child_name' => $childName,
                    'vaccine_name' => 'Booster: ' . $p->booster,
                    'vaccination_date' => $p->updated_at?->toDateString(),
                    'status' => 'Completed',
                ]);
            }
            if ($p->others) {
                $immunizationList->push([
                    'child_name' => $childName,
                    'vaccine_name' => 'Other: ' . $p->others,
                    'vaccination_date' => $p->updated_at?->toDateString(),
                    'status' => 'Completed',
                ]);
            }
            if ($p->newborn_screening_date) {
                $immunizationList->push([
                    'child_name' => $childName,
                    'vaccine_name' => 'Newborn Screening',
                    'vaccination_date' => $p->newborn_screening_date?->toDateString(),
                    'status' => 'Completed',
                ]);
            }
        }

        $immunizations = $immunizationList->sortByDesc(fn ($i) => $i['vaccination_date'] ?? '')->values();

        $prenatalRecords = PrenatalVisit::where('mother_id', $residentId)
            ->orderByDesc('visit_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($pv) => [
                'id' => $pv->id,
                'visit_date' => $pv->visit_date?->toDateString(),
                'months_of_pregnancy' => $pv->months_of_pregnancy,
                'blood_pressure' => $pv->blood_pressure,
                'weight_kg' => $pv->weight_kg ? (string) $pv->weight_kg : null,
                'height_cm' => $pv->height_cm ? (string) $pv->height_cm : null,
                'lmp' => $pv->lmp?->toDateString(),
                'edc' => $pv->edc?->toDateString(),
                'complaint' => $pv->complaint,
            ]);

        return $this->success([
            'visits' => $visits,
            'immunizations' => $immunizations,
            'maternal_records' => $maternalRecords,
            'child_records' => $childRecords,
            'prenatal_records' => $prenatalRecords,
            'note' => 'This is a copy of what the health station holds for you. '
                . 'To correct anything on it, or to ask about a consultation, '
                . 'visit the station — records are changed there, not here.',
        ], 'Your health record retrieved');
    }
}
