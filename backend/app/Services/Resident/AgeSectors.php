<?php

namespace App\Services\Resident;

use App\Models\Resident\Resident;
use Illuminate\Support\Facades\Cache;

/**
 * Keeping everybody's age brackets true to TODAY.
 *
 * Children Under Five, Child, Youth, Adult and Senior Citizen are facts about
 * a birthdate, and a birthdate turns into a different fact every birthday.
 * The nightly `residents:sync-sectors` was meant to catch those — but it only
 * runs when something runs the scheduler, and on the barangay's own computer
 * nothing does. So a child who turned five stayed on the under-five list,
 * and a thirty-one-year-old stayed Youth, for as long as nobody opened them.
 *
 * Now the register checks itself: the first request of each day brings every
 * record up to date, before anything reads the lists.
 */
final class AgeSectors
{
    /** Once a day, whatever else is or is not running. */
    public static function keepCurrent(): void
    {
        $done = 'age-sectors-current:' . now()->toDateString();

        if (Cache::has($done)) {
            return;
        }

        /* One request does it; any arriving meanwhile carry on without
           waiting — they read yesterday's brackets for a second or two. */
        Cache::lock('age-sectors-sync', 300)->get(function () use ($done) {
            if (Cache::has($done)) {
                return;
            }

            self::reconcileAll();
            Cache::put($done, true, now()->endOfDay());
        });
    }

    /**
     * Every resident with a birthdate, by the register's own rule
     * (Resident::reconcileAgeData). Sectors are loaded with each chunk, so
     * the only queries beyond two per chunk are for the records that
     * actually changed.
     *
     * @return int how many records changed
     */
    public static function reconcileAll(): int
    {
        $changed = 0;

        Resident::with('sectors')
            ->whereNotNull('birthdate')
            ->chunkById(500, function ($residents) use (&$changed) {
                foreach ($residents as $resident) {
                    if ($resident->reconcileAgeData()) {
                        $changed++;
                    }
                }
            });

        return $changed;
    }
}
