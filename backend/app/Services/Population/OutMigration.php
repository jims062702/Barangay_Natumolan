<?php

namespace App\Services\Population;

use App\Models\Account\User;
use App\Models\Population\Event;

/**
 * Somebody moved out of the barangay.
 *
 * A Transfer Out is the register saying this person no longer lives here, so
 * two things follow, the same two that follow a death: they leave the
 * population figures (`is_active`, which every count already filters on) and
 * their portal login is switched off. The portal is for residents; a person
 * who has moved away should not be asking this barangay for a clearance from
 * their new town.
 *
 * Nothing is deleted. The register keeps the person, the household keeps the
 * history, and the office can put it right at the counter if the transfer
 * was recorded in error.
 */
final class OutMigration
{
    /**
     * @return string[] what was done, for the office to read back
     */
    public static function apply(Event $event): array
    {
        if ($event->event_type !== 'Transfer Out') {
            return [];
        }

        $resident = $event->resident;

        if (! $resident) {
            return [];
        }

        $notes = [];

        if ($resident->is_active) {
            $resident->forceFill(['is_active' => false])->save();
            $notes[] = $resident->full_name . ' now counts as having moved out of the barangay.';
        }

        $account = User::where('resident_id', $resident->id)->first();

        if ($account && $account->is_active) {
            $account->forceFill(['is_active' => false])->save();
            $notes[] = 'Their portal login (' . $account->email . ') was switched off, '
                . 'so no online request can be made on this record.';
        }

        return $notes;
    }
}
