<?php

namespace App\Services\Lupon;

use App\Models\Account\Notification;
use App\Models\Lupon\CaseFile;

/**
 * Tells every party on the register that a hearing was set or moved — once
 * the summons has been served.
 *
 * Before that the case is not on their portal (CaseFile::summonsServed), and
 * a notice about a hearing on a case they cannot see — for a respondent, a
 * case they have not yet been summoned on — is the portal getting ahead of
 * the summons.
 */
final class HearingNotice
{
    public function toParties(CaseFile $case, string $subject, string $message): void
    {
        if (! $case->summonsWasIssued()) {
            return;
        }

        /* Opens the Hearings view of their Lupon Records — the date is the news. */
        foreach ($case->partyResidentIds() as $residentId) {
            Notification::notifyResident(
                $residentId, 'hearing_scheduled', $subject, $message, 'lupon_case', $case->id, '/resident/lupon/hearings'
            );
        }
    }
}
