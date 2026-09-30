<?php

namespace App\Services\Vawc;

use App\Models\Resident\Resident;

/**
 * WHO MAY BE THE COMPLAINANT OF A VAWC CASE: A WOMAN (the office's rule,
 * 2026-09-30) — online and at the desk alike.
 *
 * RA 9262 is violence against women and their children. The woman is the
 * victim-survivor on the case; her children are recorded on it as her
 * dependents, boys and girls alike. The respondent may be anybody.
 *
 * Read from the register, never from what a form says: the record's sex is
 * what the Population Office recorded, and a record that does not say is
 * not taken to mean "a woman".
 */
final class VawcComplainant
{
    public static function isWoman(Resident $resident): bool
    {
        return $resident->gender === 'Female';
    }

    /** Why this Resident ID cannot be used for a VAWC Online Complaint — to the person filing. */
    public static function onlineRefusal(Resident $resident): ?string
    {
        if (self::isWoman($resident)) {
            return null;
        }

        $elsewhere = ' To report violence against a woman or a child, go to the Barangay VAW Desk '
            . '(Monday to Friday, 8:00 AM to 5:00 PM) or the police Women and Children Protection Desk. '
            . 'In danger now? Call 911.';

        return $resident->gender === 'Male'
            ? 'The VAWC Online Complaint is filed by a woman. This Barangay Resident ID is registered to a man, '
                . 'so it cannot be used here.' . $elsewhere
            : 'The VAWC Online Complaint is filed by a woman, and the barangay record on this Resident ID does not '
                . 'say whether its holder is a man or a woman. The Population Office can complete the record.' . $elsewhere;
    }

    /** Why this person cannot be the victim-survivor of a case — to the desk. */
    public static function deskRefusal(Resident $resident): ?string
    {
        if (self::isWoman($resident)) {
            return null;
        }

        return 'The Victim-Survivor must be a woman — a VAWC case is for a woman and her children, and a child is '
            . 'added to the case as a dependent. ' . $resident->full_name . '\'s record '
            . ($resident->gender === 'Male' ? 'says Male.' : 'does not say; the Population Office can correct it.');
    }
}
