<?php

namespace App\Services\Health;

use App\Models\Health\AnimalBiteReferral;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Models\Health\Visit;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Health Station's "BARANGAY MONTHLY REPORT" — the one-page form the
 * station hands in: CONSULTATION, PRENATAL, IMMUNIZATION, POSTPARTUM and
 * ANIMAL BITE, each a few written lines, then SUBMITTED BY.
 *
 * The station wrote those lines by hand from its own logbooks. These are
 * the same counts, read from the registers the station now keeps here, so
 * the lines can be written for them — and still corrected before printing.
 *
 * Every figure is counted by the day the thing HAPPENED (the consultation,
 * the dose, the delivery, the referral), not the day somebody typed it in:
 * a card filled in on Monday for last Friday's clinic belongs to Friday.
 */
final class BarangayMonthlyReport
{
    public function build(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->toDateString();
        $to = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        return [
            'year' => $year,
            'month' => $month,
            'month_name' => strtoupper(Carbon::create($year, $month, 1)->format('F')),
            'consultation' => $this->consultations($from, $to),
            'prenatal' => $this->prenatal($from, $to),
            'immunization' => $this->immunization($from, $to),
            'postpartum' => $this->postpartum($from, $to),
            'animal_bite' => $this->animalBites($from, $to),
        ];
    }

    /** Consultations (the ITR), by sex and by what they came for. */
    private function consultations(string $from, string $to): array
    {
        $visits = fn () => Visit::whereBetween('visit_date', [$from, $to]);

        $bySex = DB::table('health_visits')
            ->leftJoin('residents', 'residents.id', '=', 'health_visits.patient_id')
            ->whereBetween('health_visits.visit_date', [$from, $to])
            ->selectRaw('residents.gender as sex, COUNT(*) as n')
            ->groupBy('residents.gender')
            ->pluck('n', 'sex');

        return [
            'total' => $visits()->count(),
            'male' => (int) ($bySex['Male'] ?? 0),
            'female' => (int) ($bySex['Female'] ?? 0),
            'by_reason' => DB::table('health_visits')
                ->whereBetween('visit_date', [$from, $to])
                ->selectRaw('visit_reason as label, COUNT(*) as total')
                ->groupBy('visit_reason')
                ->orderByDesc('total')
                ->orderBy('visit_reason')
                ->get(),
            'referred' => $visits()->where('referral_recommended', true)->count(),
        ];
    }

    /** Prenatal check-ups, the mothers seen, and pregnancies newly registered. */
    private function prenatal(string $from, string $to): array
    {
        return [
            'visits' => PrenatalVisit::whereBetween('visit_date', [$from, $to])->count(),
            'mothers' => PrenatalVisit::whereBetween('visit_date', [$from, $to])->distinct()->count('mother_id'),
            'new_pregnancies' => MaternalRecord::whereBetween('pregnancy_registration_date', [$from, $to])->count(),
        ];
    }

    /** Doses given, by vaccine, and to how many people. */
    private function immunization(string $from, string $to): array
    {
        return [
            'doses' => ImmunizationRecord::whereBetween('vaccination_date', [$from, $to])->count(),
            'people' => ImmunizationRecord::whereBetween('vaccination_date', [$from, $to])->distinct()->count('child_id'),
            'by_vaccine' => DB::table('immunization_records')
                ->whereBetween('vaccination_date', [$from, $to])
                ->selectRaw('vaccine_name as label, COUNT(*) as total')
                ->groupBy('vaccine_name')
                ->orderByDesc('total')
                ->orderBy('vaccine_name')
                ->get(),
        ];
    }

    /**
     * Mothers who gave birth this month — the station's postpartum mothers —
     * and how many of them the midwife marked for postnatal follow-up.
     */
    private function postpartum(string $from, string $to): array
    {
        $delivered = fn () => MaternalRecord::whereBetween('actual_delivery_date', [$from, $to]);

        return [
            'deliveries' => $delivered()->count(),
            'followup_required' => $delivered()->where('post_natal_followup_required', true)->count(),
        ];
    }

    /** Animal bites the station saw and referred, by animal and by category. */
    private function animalBites(string $from, string $to): array
    {
        $referred = fn () => AnimalBiteReferral::whereBetween('referred_on', [$from, $to]);

        return [
            'total' => $referred()->count(),
            'by_animal' => DB::table('animal_bite_referrals')
                ->whereBetween('referred_on', [$from, $to])
                ->selectRaw('animal as label, COUNT(*) as total')
                ->groupBy('animal')
                ->orderByDesc('total')
                ->get(),
            'by_category' => DB::table('animal_bite_referrals')
                ->whereBetween('referred_on', [$from, $to])
                ->whereNotNull('exposure_category')
                ->selectRaw('exposure_category as label, COUNT(*) as total')
                ->groupBy('exposure_category')
                ->orderBy('exposure_category')
                ->get(),
            'attended' => $referred()->where('attended', true)->count(),
        ];
    }
}
