<?php

namespace App\Services\Health;

use App\Models\Health\MaternalRecord;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Pregnancies, their numbers, and their prenatal visits — all counted from
 * the records, never stored.
 *
 * PRENATAL VISITS are the prenatal records of ONE pregnancy. A mother's first
 * pregnancy's ten visits are not her second pregnancy's: when a pregnancy is
 * completed its count stays with it, and the next one starts at nothing.
 *
 * Nothing here is incremented. Every number is a COUNT or a position,
 * worked out from what is in the database at the moment it is asked — so
 * it is the same after a refresh, on another computer, with two people
 * recording at once, and after a record is edited, moved or deleted.
 */
final class PregnancyRegister
{
    /** The mother's current pregnancy, if she has one. */
    public function activeFor(?int $motherId): ?MaternalRecord
    {
        if (! $motherId) {
            return null;
        }

        return MaternalRecord::active()->where('mother_id', $motherId)->latest('id')->first();
    }

    /**
     * "Prenatal Visits" for the current pregnancy: its records, if it is still
     * active; nothing once it is completed.
     */
    public function currentVisits(MaternalRecord $pregnancy): int
    {
        return $pregnancy->isActive() ? $pregnancy->prenatalVisits()->count() : 0;
    }

    /**
     * Each pregnancy's number for its mother — 1 for her first, 2 for her
     * second — by registration date, then by id for two on the same day.
     *
     * @param Collection<int, MaternalRecord> $pregnancies
     * @return array<int, int> pregnancy id => number
     */
    public function numbers(Collection $pregnancies): array
    {
        $out = [];
        foreach ($pregnancies as $p) {
            $date = $p->pregnancy_registration_date?->toDateString();
            $out[$p->id] = MaternalRecord::where('mother_id', $p->mother_id)->where(fn ($q) => $q
                ->where('pregnancy_registration_date', '<', $date)
                ->orWhere(fn ($same) => $same->where('pregnancy_registration_date', $date)->where('id', '<=', $p->id))
            )->count();
        }

        return $out;
    }

    /**
     * Each prenatal record's visit number within its own pregnancy — its place
     * in date order, then by id for two on the same day. Edit a record's date
     * and its number follows; delete one and the rest close up. Never typed.
     *
     * @param array<int> $pregnancyIds
     * @return array<int, int> prenatal record id => visit number
     */
    public function visitNumbers(array $pregnancyIds): array
    {
        if (! $pregnancyIds) {
            return [];
        }

        $rows = DB::table('prenatal_visits')
            ->whereIn('pregnancy_id', array_values(array_unique($pregnancyIds)))
            ->orderBy('pregnancy_id')->orderBy('visit_date')->orderBy('id')
            ->get(['id', 'pregnancy_id']);

        $out = [];
        $seen = [];
        foreach ($rows as $r) {
            $seen[$r->pregnancy_id] = ($seen[$r->pregnancy_id] ?? 0) + 1;
            $out[$r->id] = $seen[$r->pregnancy_id];
        }

        return $out;
    }
}
