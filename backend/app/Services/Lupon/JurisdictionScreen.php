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
    /** The legal words. A complaint using any of them is one of these. */
    private const VAWC_KEYWORDS = [
        'vawc', 'abuse', 'violence against', 'domestic violence', 'battery',
        'batter', 'rape', 'molest', 'maltreat', 'incest', 'trafficking',
        'child abuse', 'lascivious',
    ];

    /*
     * NOBODY REPORTS BEING BEATEN IN LEGAL LANGUAGE.
     *
     * The list above catches "domestic violence" and "battery" — the words
     * a lawyer uses. A woman at the counter says "my husband hit me", and
     * in this barangay she is at least as likely to say "gibunalan ko sa
     * akong bana" or "binugbog ako ng asawa ko". None of those matched, so
     * the screen that exists to keep these OUT of Lupon mediation waved
     * them through, at the counter and now on a public form as well.
     *
     * Matched as a PAIR — harm done to somebody in a domestic relationship
     * — rather than on a single word, because "he hit my fence with his
     * truck" is a property complaint and belongs here. A pair is specific
     * enough to be worth acting on.
     *
     * The two mistakes are not equal, and the code should not treat them as
     * if they were. Wrongly routing a fence dispute to the VAWC desk costs
     * somebody a walk down the corridor. Wrongly admitting a battered woman
     * to mediation puts her in a room with the man who beat her, which the
     * law forbids for exactly that reason. So this leans towards catching.
     */
    private const HARM = [
        'hit me', 'hits me', 'beat me', 'beats me', 'beaten', 'punch', 'slap',
        'strangl', 'choke', 'kick me', 'hurt me', 'hurts me', 'threaten to kill',
        'sinaktan', 'sinasaktan', 'binugbog', 'bugbog', 'binubugbog', 'saktan',
        'gibunalan', 'gisumbag', 'gikulata', 'gipangbunalan', 'pambubugbog',
    ];

    private const DOMESTIC = [
        'husband', 'wife', 'spouse', 'partner', 'live-in', 'livein', 'boyfriend',
        'girlfriend', 'ex-husband', 'ex-wife', 'father of my', 'mother of my',
        'asawa', 'bana', 'kapikas', 'nobyo', 'nobya', 'kinasal',
        'my child', 'my son', 'my daughter', 'anak', 'bata', 'minor',
    ];

    /**
     * True when any of the texts reads as violence against women or children.
     */
    public function mentionsVawc(?string ...$texts): bool
    {
        $text = strtolower(implode(' ', $texts));

        foreach (self::VAWC_KEYWORDS as $keyword) {
            if (str_contains($text, $keyword)) {
                return true;
            }
        }

        /* Harm AND a domestic relationship, together. */
        $harmed = false;
        foreach (self::HARM as $word) {
            if (str_contains($text, $word)) {
                $harmed = true;
                break;
            }
        }

        if (! $harmed) {
            return false;
        }

        foreach (self::DOMESTIC as $who) {
            if (str_contains($text, $who)) {
                return true;
            }
        }

        return false;
    }
}
