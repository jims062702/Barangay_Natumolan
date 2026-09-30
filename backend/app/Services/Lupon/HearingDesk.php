<?php

namespace App\Services\Lupon;

use App\Models\Account\User;

/**
 * Whose desk a sitting is worked from.
 *
 * Three offices open the hearing room and they see the same calendar, but
 * only one of them may touch a given row:
 *
 *   Mediation (Tuesdays)      the Barangay Secretary. The Punong Barangay
 *                             presides; the Secretary is the officer who
 *                             prints the summons and writes the minutes.
 *   Conciliation (Thursdays)  the Lupon. The case has left the Punong
 *                             Barangay by then and is theirs to work.
 *
 * THE PUNONG BARANGAY HAS NO BUTTONS ANYWHERE, and that is the whole point
 * of this class. They conduct the sitting; they do not keep the record of
 * it. A screen that let them start, minute or cancel a sitting was a second
 * officer able to write the same record as the Secretary — and two officers
 * writing one set of minutes is how a docket comes to hold two answers.
 *
 * Reading is not gated here. Every office sees the whole calendar, because
 * knowing when the hall sits is not the same as being able to change it.
 */
final class HearingDesk
{
    /** Tuesdays with the Punong Barangay: the Secretary keeps the record. */
    public const MEDIATION_DESK = 'Main Office';

    /** Thursdays: the Lupon's own sittings, worked by the Lupon. */
    public const CONCILIATION_DESK = 'Lupon';

    /** The office that works sittings of this type. */
    public static function forType(string $hearingType): string
    {
        return $hearingType === 'Conciliation' ? self::CONCILIATION_DESK : self::MEDIATION_DESK;
    }

    /** The office that prints the summons for a case at this stage. */
    public static function forStage(string $stage): ?string
    {
        return match ($stage) {
            'For Summons' => self::MEDIATION_DESK,
            'For Lupon Summons' => self::CONCILIATION_DESK,
            default => null,
        };
    }

    /**
     * May this user work that desk?
     *
     * Admin may work any of them — it is the account the office falls back
     * on when somebody is away, and locking it out would leave a case with
     * nobody able to move it. The Punong Barangay may work none.
     */
    public static function may(?User $user, string $desk): bool
    {
        if (! $user || $user->role === 'Punong Barangay') {
            return false;
        }

        return $user->office === 'Admin' || $user->office === $desk;
    }

    /** How to say "not your desk" to the officer reading it. */
    public static function refusal(string $desk): string
    {
        return $desk === self::CONCILIATION_DESK
            ? 'The Lupon works its own Thursday sittings. This case has left the Punong Barangay, so the Lupon office takes it from here.'
            : 'The Barangay Secretary keeps the record of the Punong Barangay\'s sittings — the summons, the minutes and the agreement are all theirs to enter.';
    }
}
