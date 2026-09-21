<?php

namespace App\Support;

/**
 * The Philippine wall clock, for validating what a user typed.
 *
 * The app runs in UTC (config/app.php) but the forms submit Philippine
 * wall-clock time, exactly as the clerk reads it off the wall. Validating
 * that against Laravel's `now` compares 14:30 Manila with 06:30 UTC, which
 * goes wrong in BOTH directions:
 *
 *   before_or_equal:now  rejected "this afternoon" as being in the future,
 *                        so a VAWC intake or a mediation could not be
 *                        recorded at all after 8am;
 *   after:now            accepted times up to 8 hours in the PAST, so a
 *                        hearing could be booked backwards.
 *
 * Compare against Manila's clock instead, in the same naive frame the form
 * sent. Use these instead of the literal `now` / `today` in date rules.
 */
final class ManilaTime
{
    public const ZONE = 'Asia/Manila';

    /** "Y-m-d H:i:s" for the current Philippine wall-clock time. */
    public static function now(): string
    {
        return now(self::ZONE)->toDateTimeString();
    }

    /** "Y-m-d" for the current Philippine date. */
    public static function today(): string
    {
        return now(self::ZONE)->toDateString();
    }
}
