<?php

namespace App\Services\Lupon;

use App\Models\Account\Notification;
use App\Models\Lupon\CaseFile;

/** Tells every party on the register that a hearing was set or moved. */
final class HearingNotice
{
    public function toParties(CaseFile $case, string $subject, string $message): void
    {
        foreach ($case->partyResidentIds() as $residentId) {
            Notification::notifyResident($residentId, 'hearing_scheduled', $subject, $message, 'lupon_case', $case->id);
        }
    }
}
