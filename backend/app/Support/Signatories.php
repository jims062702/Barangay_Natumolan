<?php

namespace App\Support;

use App\Models\Council\Official;

/**
 * Who signs the barangay's reports.
 *
 * The Punong Barangay and the Barangay Secretary come from the officials
 * roster — the one list the office already keeps up — so a new secretary is
 * one edit there, not one per form. The rest (the court, the DILG officer,
 * the VAW Desk person) are not officials of this barangay and come from
 * config/barangay.php.
 *
 * Names are sent as the roster holds them ("HON. RAFAEL P. VIDAL"); each
 * form decides whether it prints the "HON.", because the barangay's own
 * forms differ on that.
 */
final class Signatories
{
    public static function all(): array
    {
        return [
            'punong_barangay' => self::position('Punong Barangay'),
            'secretary' => self::position('Barangay Secretary'),
            ...config('barangay.signatories', []),
        ];
    }

    private static function position(string $position): ?string
    {
        return Official::where('is_active', true)
            ->where('position', $position)
            ->ordered()
            ->value('name');
    }
}
