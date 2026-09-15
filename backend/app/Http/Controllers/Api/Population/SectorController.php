<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Models\Resident\Resident;
use App\Models\Resident\Sector;
use App\Support\ManilaTime;

/** The sector lists — PWD, 4Ps, senior citizens — and how much of the barangay they cover. */
class SectorController extends BaseController
{
    /**
     * Who is on one sector list.
     *
     * Every OTHER list they are on comes too. A Population Officer planning a
     * feeding programme needs to know which of these children are also 4Ps,
     * and going back to each profile one at a time to find out is how a list
     * of forty takes an afternoon.
     *
     * "All" is a real answer here: it is how the office sees everybody who is
     * tagged at all, and — with `untagged` — everybody who is not.
     */
    public function show($sector)
    {
        $query = Resident::bonafide()
            ->where('is_active', true)
            ->with(['sectors' => fn ($q) => $q->where('is_active', true)])
            ->select([
                'id', 'resident_number', 'first_name', 'middle_name', 'last_name',
                'suffix', 'gender', 'birthdate', 'zone_purok', 'contact_number',
            ]);

        if ($sector === 'untagged') {
            $query->whereDoesntHave('sectors', fn ($q) => $q->where('is_active', true));
        } elseif ($sector !== 'all') {
            $query->whereHas('sectors', fn ($q) => $q->where('sector_type', $sector)
                ->where('is_active', true));
        } else {
            $query->whereHas('sectors', fn ($q) => $q->where('is_active', true));
        }

        $residents = $query->orderBy('last_name')->paginate(20);

        return $this->success([
            'sector' => $sector,
            'count' => $residents->total(),
            'residents' => $residents,
        ], 'Sector list retrieved');
    }

    /**
     * The sector lists, and how much of the barangay they actually cover.
     *
     * The page used to lead with the number of TAGS — 57 — which reads as a
     * headcount and is not one: one person carries several, and one carried
     * nine. So the counts come with the two numbers that make them
     * legible: how many PEOPLE are on at least one list, and how many
     * residents are on none.
     *
     * The second is the one worth acting on. A resident with no sector is
     * not a resident with nothing to claim — it is usually one nobody has
     * got to yet, and the office cannot see them any other way.
     */
    public function report()
    {
        $sectors = Sector::where('is_active', true)
            // A tag on a deleted or non-resident record is not a person the
            // barangay serves, and would inflate every list.
            ->whereHas('resident', fn ($q) => $q->bonafide()->where('is_active', true))
            ->groupBy('sector_type')
            ->selectRaw('sector_type, count(*) as count')
            ->orderByDesc('count')
            ->get();

        $population = Resident::bonafide()->where('is_active', true)->count();

        $tagged = Resident::bonafide()->where('is_active', true)
            ->whereHas('sectors', fn ($q) => $q->where('is_active', true))
            ->count();

        return $this->success([
            'sectors' => $sectors,
            'population' => $population,
            'people_on_a_list' => $tagged,
            'people_on_no_list' => $population - $tagged,
            'tags' => (int) $sectors->sum('count'),
            'coverage' => $this->sectorCoverageByMonth(),
        ], 'Sectoral report retrieved');
    }

    /**
     * How many residents have been on a list, month by month.
     *
     * The only thing on this page that is a TREND, and so the only thing a
     * line belongs on. The sector counts are thirteen unrelated categories —
     * drawing a line from Youth to Adult to Child would join things that have
     * no order, and imply a progression that does not exist.
     *
     * Counted from each person's FIRST tag, and accumulated: once somebody is
     * on a list they stay counted, so the line only ever climbs. That is what
     * makes it readable as coverage — "how much of the barangay have we got
     * to" — rather than as monthly churn.
     *
     * Twelve months, in Manila time. A tag added at eight in the morning here
     * is stored as midnight UTC, and bucketing in UTC would put a September
     * enrolment in August.
     */
    private function sectorCoverageByMonth(): array
    {
        /*
         * One row per person: the day they first appeared on any list. A
         * later tag on somebody already counted must not raise the line
         * again — that would count the person twice.
         */
        $firsts = Sector::where('is_active', true)
            ->whereHas('resident', fn ($q) => $q->bonafide()->where('is_active', true))
            ->selectRaw('resident_id, MIN(enrolled_date) as started')
            ->groupBy('resident_id')
            ->pluck('started')
            ->filter()
            ->map(fn ($d) => substr((string) $d, 0, 7))
            ->countBy();

        $now = now(ManilaTime::ZONE);
        $months = [];
        $running = 0;

        for ($back = 11; $back >= 0; $back--) {
            $month = $now->copy()->subMonths($back);
            $key = $month->format('Y-m');

            $running += (int) ($firsts[$key] ?? 0);

            $months[] = [
                'month' => $key,
                'label' => $month->format('M'),
                'joined' => (int) ($firsts[$key] ?? 0),
                'on_a_list' => $running,
            ];
        }

        /*
         * Anybody whose first tag predates the window is already covered on
         * day one, so the line starts where the barangay actually stood
         * rather than at zero.
         */
        $earlier = $firsts->filter(
            fn ($n, $key) => $key < $months[0]['month']
        )->sum();

        if ($earlier > 0) {
            foreach ($months as $i => $row) {
                $months[$i]['on_a_list'] = $row['on_a_list'] + $earlier;
            }
        }

        return $months;
    }
}
