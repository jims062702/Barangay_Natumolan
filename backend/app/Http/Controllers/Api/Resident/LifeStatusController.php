<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Http\Controllers\Api\Resident\Concerns\RegistersResidents;
use App\Models\Account\User;
use App\Models\Population\Event;
use App\Models\Resident\Resident;
use App\Services\Account\PortalAccount;
use App\Services\Content\LandingCache;
use App\Support\ManilaTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Living or deceased, and a relative from elsewhere who has moved in.
 */
class LifeStatusController extends BaseController
{
    use GuardsRegistry, RegistersResidents;

    /**
     * Records that a resident has passed away — or corrects it back.
     *
     * Death is not the same as deactivating a record, and treating it as one
     * loses everything that follows from it. So this does the whole thing:
     *
     *   - the person leaves the population figures (via `is_active`, which
     *     every count already filters on);
     *   - their FAMILY LINKS stay, because they are still somebody's father;
     *   - their portal login is switched off, because nobody should be
     *     signing in as them;
     *   - a marriage they were in ends as WIDOWED, with them named as the one
     *     who died, so the surviving spouse is marked widowed and is free to
     *     be recorded as married again;
     *   - a Death entry goes on the population register, where the office
     *     already keeps births, deaths and transfers.
     */
    public function update(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $validated = $request->validate([
            'life_status' => 'required|in:Alive,Deceased',
            'date_of_death' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'note' => 'nullable|string|max:255',
        ]);

        // `nullable` means the key is simply ABSENT when nothing was sent,
        // so it is read once here rather than three times further down.
        $note = $validated['note'] ?? null;
        $becomingDeceased = $validated['life_status'] === Resident::DECEASED;

        if ($becomingDeceased && $resident->isDeceased()) {
            return $this->error('This resident is already recorded as deceased.', 409);
        }

        $dateOfDeath = $validated['date_of_death'] ?? ManilaTime::today();

        if ($becomingDeceased && $resident->birthdate
            && $dateOfDeath < $resident->birthdate->toDateString()) {
            return $this->error('The date of death cannot be before the date of birth.', 422);
        }

        $notes = [];

        /*
         * All of it or none of it. This touches the resident, their portal
         * login, a marriage, the surviving spouse and the population
         * register; a failure part-way through used to leave the marriage
         * ended while the caller was told the whole thing had failed.
         */
        DB::transaction(function () use ($resident, $becomingDeceased, $dateOfDeath, $note, &$notes) {
        if ($becomingDeceased) {
            $resident->forceFill([
                'life_status' => Resident::DECEASED,
                'date_of_death' => $dateOfDeath,
                'life_status_note' => $note,
                // Every population count already filters on this, so they
                // leave the figures without a query having to change.
                'is_active' => false,
            ])->save();

            // Nobody should be able to sign in as them.
            $account = User::where('resident_id', $resident->id)->first();

            if ($account && $account->is_active) {
                $account->forceFill(['is_active' => false])->save();
                $notes[] = 'Their portal login (' . $account->email . ') was switched off.';
            }

            // A marriage they were in ended by death, not by choice.
            $marriage = $resident->currentMarriage();

            if ($marriage) {
                $partner = $marriage->partnerOf($resident->id);

                $marriage->forceFill([
                    'ended_on' => $dateOfDeath,
                    'end_reason' => 'Widowed',
                    'deceased_id' => $resident->id,
                ])->save();

                Resident::whereIn('id', [$marriage->resident_id, $marriage->spouse_id])
                    ->update(['spouse_id' => null]);

                if ($partner) {
                    $partner->forceFill(['civil_status' => 'Widowed'])->save();
                    $notes[] = $partner->full_name . ' is now recorded as widowed, and may be '
                        . 'recorded as married again.';
                }
            }

            Event::create([
                'resident_id' => $resident->id,
                'event_type' => 'Death',
                'event_date' => $dateOfDeath,
                'description' => 'Recorded from the resident profile.'
                    . ($note ? ' ' . $note : ''),
                'verification_status' => 'Pending',
                'recorded_by' => auth()->id(),
            ]);

            $notes[] = 'A Death entry was added to the population register for verification.';
        } else {
            $resident->forceFill([
                'life_status' => 'Alive',
                'date_of_death' => null,
                'life_status_note' => $note,
                'is_active' => true,
            ])->save();

            // Re-enable their portal login if they have an account
            $account = User::where('resident_id', $resident->id)->first();
            if ($account && ! $account->is_active) {
                $account->forceFill(['is_active' => true])->save();
                $notes[] = 'Their portal login (' . $account->email . ') was re-enabled.';
            }

            // Remove any pending death event that was recorded when marked deceased
            Event::where('resident_id', $resident->id)
                ->where('event_type', 'Death')
                ->where('verification_status', 'Pending')
                ->delete();

            $notes[] = 'Their record is active again.';
        }
        });

        LandingCache::clearStats(); // the population figure has moved

        $resident->load(['sectors', 'account:id,email,resident_id,is_active,activated_at']);

        return $this->success(
            $resident,
            $becomingDeceased
                ? $resident->full_name . ' is recorded as deceased. Their family links are kept. '
                    . implode(' ', $notes)
                : $resident->full_name . ' is recorded as living again. ' . implode(' ', $notes)
        );
    }

    /**
     * Turns a non-resident into a bona fide resident, because they moved in.
     *
     * A conversion rather than a new record: their family links, and anything
     * else already attached to them, come with them. Registering them afresh
     * would leave a duplicate behind and split the family in two — the exact
     * problem the merge tool exists to clean up.
     */
    public function convert(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if (!$resident->isNonResident()) {
            return $this->error('This person is already recorded as a barangay resident.', 409);
        }

        $rules = $this->residentRules();
        // Their own email must not collide with the record being converted.
        $rules['email'] = ['nullable', 'email', Rule::unique('residents', 'email')->ignore($resident->id)];

        $validated = $request->validate($rules, [
            'email.unique' => 'This email is already registered to another resident.',
        ]);

        /* Age brackets are the register's to work out (reconcileAgeData below). */
        $sectors = collect($validated['sectors'] ?? [])->filter()->unique()
            ->reject(fn ($s) => in_array($s, Resident::AGE_SECTORS, true))->values();
        unset($validated['sectors']);

        $validated['record_type'] = 'Resident';
        // Their outside address is replaced by a household and a purok here.
        $validated['address'] = null;
        /*
         * And a resident's number. Keeping the NR- one would leave a
         * constituent carrying the prefix that exists to say they are not
         * one — the exact confusion it was added to prevent. Nothing has
         * been issued against the old number: a non-resident cannot hold a
         * certificate, which is what makes renumbering safe here and not
         * safe for a resident.
         */
        $validated['resident_number'] = $this->generateResidentNumber();

        $resident->fill($validated);

        if ($resident->birthdate) {
            $resident->demographic_classification = $resident->primaryAgeClassification();
        }

        $resident->save();

        foreach ($sectors as $sectorType) {
            $resident->sectors()->firstOrCreate(
                ['sector_type' => $sectorType],
                ['enrolled_date' => now()->toDateString()]
            );
        }

        $resident->reconcileAgeData();

        // Now that they live here, they get what every resident gets.
        $account = PortalAccount::provision($resident, auth()->id());

        LandingCache::clearStats(); // they now count towards the population

        $resident->load('sectors');

        return $this->success(
            $this->withAccountNotice($resident, $account),
            $resident->full_name . ' is now a registered barangay resident, and their family links '
                . 'came with them.'
                . ($account['created'] ? ' A portal account was created and emailed to them.' : '')
        );
    }
}
