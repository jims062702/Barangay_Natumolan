<?php

namespace App\Http\Controllers\Api\Rbim;

use App\Http\Controllers\Api\BaseController;
use App\Models\Household\Household;
use App\Models\Rbim\Census;
use App\Models\Rbim\CensusMember;
use App\Models\Resident\Resident;
use App\Services\Rbim\CensusAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberMatchController extends BaseController
{
    public function __construct(private readonly CensusAccess $access)
    {
    }

    /**
     * Says which resident a census line is.
     *
     * Matching only — it does not create anybody. A line that turns out to be
     * somebody new is registered through the resident form, where the office
     * asks everything the register needs and the census does not.
     */
    public function update(Request $request, Census $rbimCensus, CensusMember $member): JsonResponse
    {
        if (!$this->access->canReconcile()) {
            return $this->forbidden('Only the Population Office reconciles a census');
        }

        if ($member->rbim_census_id !== $rbimCensus->id) {
            return $this->error('That line is not on this census form.', 404);
        }

        $validated = $request->validate([
            'resident_id' => 'nullable|exists:residents,id',
        ]);

        $residentId = $validated['resident_id'] ?? null;

        // One resident per form: the same person cannot be two lines of one
        // household, and a double match is how a census inflates a household.
        if ($residentId) {
            $taken = $rbimCensus->members()
                ->where('resident_id', $residentId)
                ->where('id', '!=', $member->id)
                ->exists();

            if ($taken) {
                return $this->error(
                    'That resident is already matched to another line on this form.',
                    409
                );
            }
        }

        $member->update(['resident_id' => $residentId]);

        /*
         * The contact details go with the person.
         *
         * This is the whole reason they are collected: a resident with no
         * email on file cannot be given a portal account. Carried over only
         * where the register has NOTHING — a census is what one household
         * said on one evening, and it does not get to overwrite an address
         * the office already holds.
         */
        $carried = [];

        if ($residentId) {
            $resident = Resident::find($residentId);

            if ($resident) {
                if ($member->email && !$resident->email) {
                    // The register keeps one login per address, so a clash is
                    // reported rather than written.
                    $taken = Resident::where('email', $member->email)
                        ->where('id', '!=', $resident->id)->exists();

                    if ($taken) {
                        $carried[] = 'the email ' . $member->email
                            . ' already belongs to another resident, so it was not copied across';
                    } else {
                        $resident->forceFill(['email' => $member->email])->save();
                        $carried[] = 'their email was added, so a portal account can be issued';
                    }
                }

                if ($member->contact_number && !$resident->contact_number) {
                    $resident->forceFill(['contact_number' => $member->contact_number])->save();
                    $carried[] = 'their phone number was added';
                }
            }
        }

        /*
         * The house follows the household.
         *
         * The census is one household — that is what the form is. So once a
         * line is matched, the resident behind it belongs to that household,
         * and making the clerk open each profile afterwards to say so again
         * is asking the same question twice and getting it wrong once.
         *
         * Where the household comes from, in order:
         *   1. the household this form was explicitly linked to, or
         *   2. whichever household the HEAD's line was matched into — the
         *      head is line 1 and matched first, so by the time anybody
         *      else is matched it is usually already known.
         *
         * Nothing is invented: if neither is known, the resident's own
         * household is left exactly as it was.
         */
        $note = '';

        if ($residentId) {
            $householdId = $rbimCensus->household_id ?: $this->headHouseholdOf($rbimCensus);

            if ($householdId) {
                $resident = Resident::find($residentId);

                if ($resident && $resident->household_id !== $householdId) {
                    $resident->forceFill(['household_id' => $householdId])->save();

                    $house = Household::find($householdId);
                    $note = ' They are now recorded in household '
                        . ($house?->household_number ?? '#' . $householdId) . '.';
                }

                // Remembered on the form, so the next line matched does not
                // have to work it out again.
                if (!$rbimCensus->household_id) {
                    $rbimCensus->forceFill(['household_id' => $householdId])->save();
                }
            }
        }

        return $this->success(
            $member->load('resident:id,resident_number,first_name,last_name'),
            $residentId
                ? $member->full_name . ' matched to the register.' . $note
                    . ($carried !== [] ? ' Also: ' . implode('; ', $carried) . '.' : '')
                : 'Match removed.'
        );
    }

    /**
     * The household of whoever was matched to the head's line.
     *
     * Q2 = 1 is "Head" on the form; falling back to line 1 covers a census
     * where the relationship column was left blank, which happens.
     */
    private function headHouseholdOf(Census $census): ?int
    {
        $head = $census->members()
            ->whereNotNull('resident_id')
            ->orderByRaw('q2_relationship = 1 DESC')
            ->orderBy('line_no')
            ->with('resident:id,household_id')
            ->first();

        return $head?->resident?->household_id;
    }
}
