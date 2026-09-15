<?php

namespace App\Services\Lupon;

/**
 * Whether a complaint is one the Lupon may hear at all.
 *
 * VAWC and child-abuse matters are OUTSIDE Katarungang Pambarangay
 * jurisdiction and must never enter Lupon mediation. The screen is a keyword
 * check over what the complainant said; it runs when the complaint is filed
 * and again when the case is screened, and both used to carry their own copy
 * of the list.
 */
final class JurisdictionScreen
{
    private const VAWC_KEYWORDS = [
        'vawc', 'abuse', 'violence against', 'domestic violence', 'battery',
        'batter', 'rape', 'molest', 'maltreat', 'incest', 'trafficking',
        'child abuse', 'lascivious',
    ];

    /** True when any of the texts reads as violence against women or children. */
    public function mentionsVawc(?string ...$texts): bool
    {
        $text = strtolower(implode(' ', $texts));

        foreach (self::VAWC_KEYWORDS as $keyword) {
            if (str_contains($text, $keyword)) {
                return true;
            }
        }

        return false;
    }
}
