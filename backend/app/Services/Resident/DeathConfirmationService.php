<?php

namespace App\Services\Resident;

use App\Models\Account\User;
use App\Models\Population\Event;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Services\Content\LandingCache;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DeathConfirmationService
{
    /**
     * Determine the relationship of the requester to the deceased resident.
     *
     * Returns: 'Child', 'Parent', 'Spouse', 'Sibling', 'Grandchild', 'Grandparent',
     * 'Niece/Nephew', 'Aunt/Uncle', 'Cousin', 'Guardian', 'Ward', or null.
     */
    public function getRelationship(Resident $requester, Resident $deceased): ?string
    {
        if ($requester->id === $deceased->id) {
            return null;
        }

        // 1. Is deceased a parent of requester? (Requester is Child)
        if ($requester->parents()->where('residents.id', $deceased->id)->exists()) {
            return 'Child';
        }

        // 2. Is deceased a child of requester? (Requester is Parent)
        if ($requester->children()->where('residents.id', $deceased->id)->exists()) {
            return 'Parent';
        }

        // 3. Are they spouses?
        if ($requester->spouse_id === $deceased->id || $deceased->spouse_id === $requester->id) {
            return 'Spouse';
        }
        $marriage = Marriage::where(function ($q) use ($requester, $deceased) {
            $q->where('resident_id', $requester->id)->where('spouse_id', $deceased->id);
        })->orWhere(function ($q) use ($requester, $deceased) {
            $q->where('resident_id', $deceased->id)->where('spouse_id', $requester->id);
        })->whereNull('ended_on')->first();

        if ($marriage) {
            return 'Spouse';
        }

        // 4. Are they siblings?
        if ($requester->siblings()->contains('id', $deceased->id)) {
            return 'Sibling';
        }

        // 5. Is deceased a grandparent of requester? (Requester is Grandchild)
        if ($requester->grandparents()->contains('id', $deceased->id)) {
            return 'Grandchild';
        }

        // 6. Is requester a grandparent of deceased? (Requester is Grandparent)
        if ($deceased->grandparents()->contains('id', $requester->id)) {
            return 'Grandparent';
        }

        // 7. Is deceased an aunt or uncle of requester? (Requester is Niece/Nephew)
        if ($requester->auntsAndUncles()->contains('id', $deceased->id)) {
            return 'Niece/Nephew';
        }

        // 8. Is requester an aunt or uncle of deceased? (Requester is Aunt/Uncle)
        if ($deceased->auntsAndUncles()->contains('id', $requester->id)) {
            return 'Aunt/Uncle';
        }

        // 9. Are they cousins?
        if ($requester->cousins()->contains('id', $deceased->id)) {
            return 'Cousin';
        }

        // 10. Guardianship
        if ($requester->guardians()->where('residents.id', $deceased->id)->exists()) {
            return 'Ward';
        }
        if ($requester->wards()->where('residents.id', $deceased->id)->exists()) {
            return 'Guardian';
        }

        // 11. Same household?
        if ($requester->household_id && $requester->household_id === $deceased->household_id) {
            return 'Household Member';
        }

        return null;
    }

    /**
     * Safely and transactionally mark a resident as deceased following confirmation of death.
     */
    public function confirmDeath(
        Resident $deceased,
        string $dateOfDeath,
        ?string $note = null,
        ?int $clerkUserId = null,
        ?Certificate $certificate = null
    ): void {
        if ($deceased->isDeceased()) {
            // Already marked deceased — if certificate is passed, just record confirmation on certificate
            if ($certificate) {
                $fields = $certificate->template_fields ?? [];
                $fields['death_confirmed'] = true;
                $fields['death_confirmed_at'] = now()->toIso8601String();
                $fields['death_confirmed_by'] = $clerkUserId;
                $certificate->update(['template_fields' => $fields]);
            }
            return;
        }

        $dateOfDeath = Carbon::parse($dateOfDeath)->toDateString();

        if ($deceased->birthdate && $dateOfDeath < $deceased->birthdate->toDateString()) {
            throw new InvalidArgumentException('Date of death cannot be earlier than the resident date of birth.');
        }

        DB::transaction(function () use ($deceased, $dateOfDeath, $note, $clerkUserId, $certificate) {
            // 1. Mark resident deceased & inactive
            $deceasedNote = $note ?: ('Certified deceased via Certification of Death' . ($certificate ? ' (' . $certificate->certificate_number . ')' : ''));
            $deceased->forceFill([
                'life_status' => Resident::DECEASED,
                'date_of_death' => $dateOfDeath,
                'life_status_note' => $deceasedNote,
                'is_active' => false,
            ])->save();

            // 2. Disable their resident portal account
            $account = User::where('resident_id', $deceased->id)->first();
            if ($account && $account->is_active) {
                $account->forceFill(['is_active' => false])->save();
            }

            // 3. End current marriage
            $marriage = $deceased->currentMarriage();
            if ($marriage) {
                $partner = $marriage->partnerOf($deceased->id);
                $marriage->forceFill([
                    'ended_on' => $dateOfDeath,
                    'end_reason' => 'Widowed',
                    'deceased_id' => $deceased->id,
                ])->save();

                Resident::whereIn('id', [$marriage->resident_id, $marriage->spouse_id])
                    ->update(['spouse_id' => null]);

                if ($partner) {
                    $partner->forceFill(['civil_status' => 'Widowed'])->save();
                }
            }

            // 4. Record Population Death event
            Event::create([
                'resident_id' => $deceased->id,
                'event_type' => 'Death',
                'event_date' => $dateOfDeath,
                'description' => $deceasedNote,
                'verification_status' => 'Verified',
                'recorded_by' => $clerkUserId,
                'verification_notes' => 'Confirmed via Certification of Death' . ($certificate ? ' #' . $certificate->certificate_number : ''),
            ]);

            // 5. Update certificate template_fields if provided
            if ($certificate) {
                $fields = $certificate->template_fields ?? [];
                $fields['death_confirmed'] = true;
                $fields['death_confirmed_at'] = now()->toIso8601String();
                $fields['death_confirmed_by'] = $clerkUserId;
                $certificate->update(['template_fields' => $fields]);
            }
        });

        LandingCache::clearStats();
    }
}
