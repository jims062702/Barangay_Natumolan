<?php

namespace App\Services\Population;

use App\Models\Account\User;
use App\Models\Household\Household;
use App\Models\Population\Event;
use App\Models\Resident\Resident;
use App\Models\Resident\Sector;
use App\Support\ManilaTime;

/**
 * The population dashboard's figures.
 *
 * Non-residents are on the register only so families can be linked; they
 * are not part of the barangay's population, and nothing here counts them.
 */
final class Analytics
{
    public function summary(): array
    {
        // Non-residents are on the register only so families can be
        // linked; they are not part of the barangay's population.
        $totalPopulation = Resident::bonafide()->where('is_active', true)->count();
        $households = Household::count();

        return [
            'total_population' => $totalPopulation,
            'total_households' => $households,
            'average_household_size' => $households > 0 ? round($totalPopulation / $households, 2) : 0,
            'population_by_age_group' => $this->ageGroups(),
            'population_by_gender' => $this->genders(),
            'headcount' => self::headcount(),
            'population_by_zone' => Resident::bonafide()->where('is_active', true)
                ->groupBy('zone_purok')
                ->selectRaw('zone_purok, count(*) as count')
                ->orderBy('zone_purok')
                ->get(),
            'events_this_year' => Event::whereYear('event_date', date('Y'))
                ->where(function ($q) {
                    $q->where('event_type', '!=', 'Death')
                      ->orWhereHas('resident', fn ($rq) => $rq->where('life_status', 'Deceased'));
                })
                ->groupBy('event_type')
                ->selectRaw('event_type, count(*) as count')
                ->get(),
            'portal_accounts' => User::where('role', 'Resident')->count(),
            'dependency' => $this->dependency(),
            'migration' => $this->migration(),
            'growth' => $this->growth($totalPopulation),
            'sector_counts' => Sector::where('is_active', true)
                ->groupBy('sector_type')
                ->selectRaw('sector_type, count(*) as count')
                ->orderByDesc('count')
                ->get(),
            'intervention' => $this->interventionShortlist(),
            'register_by_month' => $this->registerByMonth(),
        ];
    }

    /**
     * The five age bands, counted by the database.
     *
     * Today's date is passed in rather than left to the database's CURDATE():
     * the barangay's day turns over in Manila, and a server keeping UTC would
     * put an evening birthday into yesterday.
     *
     * A resident with no birthdate falls into no band at all — which is what
     * the dependency figures call `unknown_age`, and is a different answer
     * from being a baby.
     */
    private function ageGroups(): array
    {
        $today = now(ManilaTime::ZONE)->toDateString();
        $years = 'TIMESTAMPDIFF(YEAR, birthdate, ?)';

        $counted = Resident::bonafide()->where('is_active', true)
            ->whereNotNull('birthdate')
            ->selectRaw(
                "CASE
                    WHEN {$years} <= 5 THEN '0-5 years'
                    WHEN {$years} <= 12 THEN '6-12 years'
                    WHEN {$years} <= 18 THEN '13-18 years'
                    WHEN {$years} < 60 THEN '19-59 years'
                    ELSE '60+ years'
                END as band, COUNT(*) as total",
                array_fill(0, 4, $today)
            )
            ->groupBy('band')
            ->pluck('total', 'band');

        /* Named in order, so an empty band is a 0 rather than a missing bar. */
        $bands = ['0-5 years', '6-12 years', '13-18 years', '19-59 years', '60+ years'];

        return array_combine(
            $bands,
            array_map(fn ($band) => (int) ($counted[$band] ?? 0), $bands)
        );
    }

    /**
     * The four figures a barangay report asks for: male and female, adults
     * (18 and over) and minors (17 and under) — the living residents on the
     * register, as they stand today in Manila.
     *
     * Somebody whose sex or birthdate the register does not have is counted
     * in the population and in neither pair, and said separately — so the
     * pairs add up to the total once those are added back, and nobody is
     * quietly guessed into a column.
     *
     * Static, because the VAW desk's annual report prints the same figures
     * on its header and must not arrive at different ones.
     */
    public static function headcount(): array
    {
        $living = fn () => Resident::bonafide()->where('is_active', true);
        $today = now(ManilaTime::ZONE)->toDateString();
        $adultBorn = now(ManilaTime::ZONE)->subYears(18)->toDateString();

        $total = $living()->count();
        $male = $living()->where('gender', 'Male')->count();
        $female = $living()->where('gender', 'Female')->count();
        $adults = $living()->whereNotNull('birthdate')->where('birthdate', '<=', $adultBorn)->count();
        $minors = $living()->whereNotNull('birthdate')->where('birthdate', '>', $adultBorn)->where('birthdate', '<=', $today)->count();

        return [
            'total' => $total,
            'male' => $male,
            'female' => $female,
            'sex_not_recorded' => $total - $male - $female,
            'adults' => $adults,
            'minors' => $minors,
            'age_not_recorded' => $total - $adults - $minors,
            'as_of' => $today,
        ];
    }

    private function genders()
    {
        return [
            'Male' => Resident::bonafide()->where('is_active', true)->where('gender', 'Male')->count(),
            'Female' => Resident::bonafide()->where('is_active', true)->where('gender', 'Female')->count(),
            'Other' => Resident::bonafide()->where('is_active', true)->where('gender', 'Other')->count(),
        ];
    }

    /**
     * Standard dependency groups: young (0-14) and old (65+) are dependants
     * carried by the working-age band (15-64). The dependency ratio is
     * dependants per 100 working-age residents.
     */
    private function dependency(): array
    {
        // Non-residents are relatives elsewhere; a dependency ratio built
        // on them describes no population that exists.
        $today = now(ManilaTime::ZONE)->toDateString();
        $years = 'TIMESTAMPDIFF(YEAR, birthdate, ?)';

        $counted = Resident::bonafide()->where('is_active', true)
            ->whereNotNull('birthdate')
            ->selectRaw(
                "CASE
                    WHEN {$years} <= 14 THEN 'young'
                    WHEN {$years} <= 64 THEN 'working'
                    ELSE 'old'
                END as band, COUNT(*) as total",
                array_fill(0, 2, $today)
            )
            ->groupBy('band')
            ->pluck('total', 'band');

        $young = (int) ($counted['young'] ?? 0);
        $working = (int) ($counted['working'] ?? 0);
        $old = (int) ($counted['old'] ?? 0);

        $ratio = fn ($count) => $working > 0 ? round(($count / $working) * 100, 1) : 0;

        return [
            'young_dependents' => $young,
            'working_age' => $working,
            'old_dependents' => $old,
            'unknown_age' => Resident::bonafide()->where('is_active', true)
                ->whereNull('birthdate')->count(),
            'youth_dependency_ratio' => $ratio($young),
            'old_age_dependency_ratio' => $ratio($old),
            'total_dependency_ratio' => $ratio($young + $old),
        ];
    }

    /** In- and out-migration recorded for the year, and the net movement. */
    private function migration(): array
    {
        $year = date('Y');
        $count = fn (string $type) => Event::whereYear('event_date', $year)
            ->where('event_type', $type)
            ->count();

        $in = $count('Transfer In');
        $out = $count('Transfer Out');

        return [
            'year' => (int) $year,
            'in_migration' => $in,
            'out_migration' => $out,
            'net_migration' => $in - $out,
        ];
    }

    /**
     * Population change for the year: natural increase (births less deaths)
     * plus net migration, expressed against the current headcount.
     */
    private function growth(int $totalPopulation): array
    {
        $year = date('Y');
        $count = fn (string $type) => Event::whereYear('event_date', $year)
            ->where('event_type', $type)
            ->count();

        $births = $count('Birth');
        $deaths = $count('Death');
        $natural = $births - $deaths;
        $net = $natural + ($count('Transfer In') - $count('Transfer Out'));

        // Growth is measured against the headcount at the start of the year,
        // i.e. the current total less this year's net change.
        $base = $totalPopulation - $net;

        return [
            'year' => (int) $year,
            'births' => $births,
            'deaths' => $deaths,
            'natural_increase' => $natural,
            'net_change' => $net,
            'growth_rate' => $base > 0 ? round(($net / $base) * 100, 2) : 0,
            'newly_registered' => Resident::whereYear('created_at', $year)->count(),
        ];
    }

    /**
     * Households carrying a vulnerability indicator — a shortlist for
     * possible intervention, NOT an official needs assessment. A household is
     * flagged when any member holds one of the priority sectors below.
     */
    private function interventionShortlist(): array
    {
        /*
         * The four lists this barangay actually keeps. Unemployed and
         * Pregnant Women were here too, and a shortlist built on a list
         * nobody maintains points the office at the wrong households.
         */
        $indicators = ['4Ps Household', 'PWD', 'Solo Parent', 'Indigent'];

        /*
         * A household is counted ONCE per indicator, however many of its
         * members carry it — which is what COUNT(DISTINCT household_id) says
         * in one pass, rather than loading every flagged resident with their
         * tags and walking the list six times.
         */
        $flagged = Sector::query()
            ->where('resident_sectors.is_active', true)
            ->whereIn('resident_sectors.sector_type', $indicators)
            ->join('residents', 'residents.id', '=', 'resident_sectors.resident_id')
            ->where('residents.is_active', true)
            ->where('residents.record_type', '!=', Resident::NON_RESIDENT)
            ->whereNotNull('residents.household_id');

        $perIndicator = (clone $flagged)
            ->selectRaw('resident_sectors.sector_type, COUNT(DISTINCT residents.household_id) as households')
            ->groupBy('resident_sectors.sector_type')
            ->pluck('households', 'sector_type');

        /* Named in the order the office reads them, zeros included. */
        $byIndicator = [];
        foreach ($indicators as $indicator) {
            $byIndicator[$indicator] = (int) ($perIndicator[$indicator] ?? 0);
        }

        return [
            'households_flagged' => (int) (clone $flagged)
                ->distinct()->count('residents.household_id'),
            'by_indicator' => $byIndicator,
            'indicators' => $indicators,
        ];
    }

    /**
     * The headcount, month by month.
     *
     * Every other figure on this dashboard is a snapshot: fifty residents,
     * ninety households, today. None of them says whether that fifty is
     * growing, and a barangay planning a health post or a feeding programme
     * is asking exactly that.
     *
     * Counted from the month each person was added to the register and then
     * accumulated, so the line only ever climbs and reads as "how far the
     * register has got" rather than as monthly churn. People who have since
     * left are not carried: this is the register as it stands, laid out over
     * the months it was built in.
     */
    private function registerByMonth(): array
    {
        $joined = Resident::bonafide()->where('is_active', true)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count")
            ->groupBy('month')
            ->pluck('count', 'month');

        $now = now(ManilaTime::ZONE);
        $months = [];
        $running = 0;

        for ($back = 11; $back >= 0; $back--) {
            $month = $now->copy()->startOfMonth()->subMonths($back);
            $key = $month->format('Y-m');
            $added = (int) ($joined[$key] ?? 0);
            $running += $added;

            $months[] = [
                'month' => $key,
                'label' => $month->format('M'),
                'added' => $added,
                'on_the_register' => $running,
            ];
        }

        /*
         * Anybody registered before the window is already counted on day
         * one, so the line starts where the barangay actually stood rather
         * than at zero — and the last month equals the headcount in the tile
         * above it.
         */
        $earlier = $joined->filter(fn ($n, $key) => $key < $months[0]['month'])->sum();

        if ($earlier > 0) {
            foreach ($months as $i => $row) {
                $months[$i]['on_the_register'] = $row['on_the_register'] + $earlier;
            }
        }

        return $months;
    }
}
