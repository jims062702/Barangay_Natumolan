<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\DescribesFamily;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Http\Controllers\Api\Resident\Concerns\LinksFamily;
use App\Http\Controllers\Api\Resident\Concerns\RegistersResidents;
use App\Models\Household\Household;
use App\Models\Resident\Guardianship;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Services\Account\PortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A resident's family: read, added to, linked and unlinked.
 */
class FamilyController extends BaseController
{
    use DescribesFamily, GuardsRegistry, LinksFamily, RegistersResidents;

    /** Everyone this resident is connected to, in both directions. */
    public function show(Resident $resident): JsonResponse
    {
        $resident->load([
            'parents.parents.children.children', 'parents.children', 'children', 'spouse',
            'guardians', 'wards',
        ]);

        return $this->success(
            $this->bloodline($resident)
                + $this->derivedRelatives($resident)
                + $this->careArrangements($resident),
            'Family retrieved'
        );
    }

    /**
     * Registers a NEW resident and links them to this one as a parent, child
     * or spouse in a single step — the "Add parent / Add child / Add spouse"
     * buttons on a profile. The body is an ordinary resident registration, so
     * the new person lands in the registry properly and gets their own portal
     * account like anybody else.
     */
    public function store(Request $request, Resident $resident, string $relation): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if (!in_array($relation, ['parent', 'child', 'spouse', 'guardian'], true)) {
            return $this->error('Relationship must be parent, child, spouse or guardian', 422);
        }

        /*
         * A relative who lives outside the barangay is recorded, but only
         * lightly: no purok, no residency status, no portal account. They can
         * be converted to a full resident later if they move in, and their
         * family history comes with them.
         */
        $isNonResident = $request->input('record_type') === Resident::NON_RESIDENT;

        $rules = $isNonResident ? $this->nonResidentRules() : $this->residentRules();
        // Mother / Father / Guardian, or Son / Daughter — free text so step-
        // and adoptive arrangements can be recorded as the barangay words them.
        $rules['relationship'] = 'nullable|string|max:40';
        /*
         * Parents very often live in their OWN house by the time their
         * children are registering families of their own. Recording that in
         * the same step is the difference between one form and three: pick
         * their household here, and make them its head if it is theirs.
         */
        $rules['make_household_head'] = 'boolean';
        // Married, or living together without being married.
        $rules['union_type'] = 'nullable|in:' . implode(',', Marriage::UNION_TYPES);
        /*
         * The child's OTHER parent, when the two are not married so there is
         * no spouse to infer them from. Without this, unmarried partners had
         * to enter every child twice — once on each of their records.
         */
        $rules['other_parent_id'] = 'nullable|exists:residents,id';
        /*
         * A guardianship, when the person being registered is the one raising
         * this child. Rare on this path — the lola is usually already on the
         * register, so `family/link` is the usual door — but a family that has
         * just moved in arrives all at once.
         */
        $rules['guardian_reason'] = 'nullable|string|max:60';
        $rules['guardian_started_on'] = 'nullable|date';
        $rules['guardian_note'] = 'nullable|string|max:255';
        $rules['is_primary'] = 'boolean';
        /*
         * Registering a CHILD who does not live with the parent being entered
         * — the commonest reason a child is registered at all when both
         * parents are away. The house comes from the guardian, and the
         * guardianship is recorded in the same step rather than left as a
         * second job the clerk has to remember.
         */
        $rules['guardian_id'] = 'nullable|exists:residents,id';
        $rules['guardian_relation'] = 'nullable|string|max:40';
        /*
         * What to do with children the partner already has. Left out, nothing
         * is done to them — see attachChildrenToNewSpouse.
         */
        $rules['existing_children'] = 'nullable|in:none,shared';

        $validated = $request->validate($rules, [
            'email.unique' => 'This email is already registered to another resident.',
        ]);

        if ($relation === 'spouse' && $resident->spouse_id) {
            return $this->error(
                $resident->full_name . ' is already recorded as partnered with '
                    . ($resident->spouse?->full_name ?? 'another resident')
                    . '. End that first — record whether it was a separation, '
                    . 'an annulment or a death — and this one can then be added.',
                409
            );
        }

        if ($conflict = $this->namesakeCheck($request, $validated)) {
            return $conflict;
        }

        $label = $validated['relationship'] ?? null;
        $makeHead = $request->boolean('make_household_head');
        $unionType = $validated['union_type'] ?? 'Married';
        $otherParentId = $validated['other_parent_id'] ?? null;
        $childrenAre = $validated['existing_children'] ?? null;
        $carerId = $validated['guardian_id'] ?? null;
        $carerRelation = $validated['guardian_relation'] ?? null;
        $guardian = [
            'reason' => $validated['guardian_reason'] ?? null,
            'started_on' => $validated['guardian_started_on'] ?? null,
            'note' => $validated['guardian_note'] ?? null,
            'is_primary' => $request->boolean('is_primary', true),
        ];
        unset(
            $validated['relationship'],
            $validated['make_household_head'],
            $validated['union_type'],
            $validated['other_parent_id'],
            $validated['guardian_reason'],
            $validated['guardian_started_on'],
            $validated['guardian_note'],
            $validated['is_primary'],
            $validated['existing_children'],
            $validated['guardian_id'],
            $validated['guardian_relation'],
        );

        /*
         * The person raising them, when one was named. Resolved before
         * anybody is created, so a bad id is a clean 422 rather than a
         * half-made child with no carer attached.
         */
        $carer = $carerId ? Resident::find($carerId) : null;

        if ($carerId && !$carer) {
            return $this->error('That guardian is not on the register.', 422);
        }

        if ($isNonResident) {
            $validated['record_type'] = Resident::NON_RESIDENT;
        } else {
            /*
             * A child left with a lola lives in HER house, not in the house of
             * the parent being entered — who is very often not in the barangay
             * at all. The guardian decides the address when there is one;
             * otherwise a relative at the same address is the common case.
             */
            $validated['household_id'] = $validated['household_id']
                ?? $carer?->household_id
                ?? $resident->household_id;

            if ($carer?->zone_purok && empty($validated['zone_purok'])) {
                $validated['zone_purok'] = $carer->zone_purok;
            }
        }

        $relative = $this->createResident($validated);
        $notes = $this->link(
            $resident, $relative, $relation, $label, $unionType, $otherParentId, $guardian, $childrenAre
        );

        /*
         * The unmarried equivalent of the spouse rule: a child belongs to both
         * parents whether or not there was a wedding.
         */
        if ($relation === 'child' && $otherParentId && $otherParentId !== $resident->id) {
            $otherParent = Resident::find($otherParentId);

            // `link()` has already handled them if they are also the spouse.
            if ($otherParent && !$otherParent->children()->where('residents.id', $relative->id)->exists()) {
                $otherParent->children()->syncWithoutDetaching([$relative->id => [
                    'parent_role' => Resident::roleLabel($otherParent->gender, 'parent'),
                    'child_role' => $label ?: Resident::roleLabel($relative->gender, 'child'),
                ]]);
                $notes[] = 'Also recorded as a child of ' . $otherParent->full_name . '.';
            }
        }

        if ($carer) {
            $notes = array_merge($notes, $this->recordGuardianship($relative, $carer, $carerRelation, [
                'reason' => $guardian['reason'],
                'started_on' => $guardian['started_on'],
                'note' => $guardian['note'],
                'is_primary' => true,
            ]));
        }

        if ($makeHead && $relative->household_id) {
            $household = Household::find($relative->household_id);
            $previous = $household?->head;

            // Same door as every other hand-over, so this one is in the
            // history too — this is exactly the "the house passed to the
            // next of kin" case.
            $household?->handOverTo($relative, 'Inherited', 'Recorded when adding a family member.');

            $notes[] = $previous && $previous->id !== $relative->id
                ? 'Now the owner of household ' . $household->household_number
                    . ', replacing ' . $previous->full_name . '.'
                : 'Now the owner of household ' . $household?->household_number . '.';
        }
        $account = PortalAccount::provision($relative, auth()->id());

        return $this->success(
            $this->withAccountNotice($relative, $account) + ['family_notes' => $notes],
            $this->linkMessage($resident, $relative, $relation, $notes, $account),
            201
        );
    }

    /**
     * Links two people who are BOTH already registered — the usual case for
     * parents, who are typically in the registry long before their children.
     */
    public function connect(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $validated = $request->validate([
            'relative_id' => 'required|exists:residents,id',
            'relation' => 'required|in:parent,child,spouse,guardian',
            'relationship' => 'nullable|string|max:40',
            'union_type' => 'nullable|in:' . implode(',', Marriage::UNION_TYPES),
            // The usual door for a guardianship: the lola is almost always
            // already on the register, often as the head of the very
            // household the child was registered into.
            'guardian_reason' => 'nullable|string|max:60',
            'guardian_started_on' => 'nullable|date',
            'guardian_note' => 'nullable|string|max:255',
            'is_primary' => 'boolean',
            // See addRelative. Left out, the children already on the record
            // are not touched at all.
            'existing_children' => 'nullable|in:none,shared',
            /*
             * Who the child's second parent is.
             *
             * addRelative took this and this endpoint did not, so a child
             * ALREADY on the register could never be given their other
             * parent — and that is the ordinary case, because the child is
             * usually entered first and linked to a parent afterwards. The
             * fallback then attached them to whoever the subject happened to
             * be married to, which is a guess.
             */
            'other_parent_id' => 'nullable|exists:residents,id',
        ]);

        $relative = Resident::findOrFail($validated['relative_id']);

        if ($relative->id === $resident->id) {
            return $this->error('A resident cannot be their own relative.', 422);
        }

        if ($error = $this->linkBlocker($resident, $relative, $validated['relation'])) {
            return $this->error($error, 409);
        }

        $otherParentId = $validated['other_parent_id'] ?? null;

        $notes = $this->link(
            $resident,
            $relative,
            $validated['relation'],
            $validated['relationship'] ?? null,
            $validated['union_type'] ?? 'Married',
            $otherParentId,
            [
                'reason' => $validated['guardian_reason'] ?? null,
                'started_on' => $validated['guardian_started_on'] ?? null,
                'note' => $validated['guardian_note'] ?? null,
                'is_primary' => $request->boolean('is_primary', true),
            ],
            $validated['existing_children'] ?? null
        );

        /*
         * Naming the other parent has to ATTACH them, not merely stop the
         * spouse being assumed. Passing the id and getting a child with one
         * parent is the same silent failure as not asking at all.
         *
         * A step-child is left alone: link() has already refused to give
         * them a second parent, because their own two are recorded elsewhere.
         */
        if ($validated['relation'] === 'child'
            && $otherParentId
            && $otherParentId !== $resident->id) {

            $otherParent = Resident::find($otherParentId);

            if ($otherParent && !$otherParent->children()->where('residents.id', $relative->id)->exists()) {
                $otherParent->children()->syncWithoutDetaching([$relative->id => [
                    'parent_role' => Resident::roleLabel($otherParent->gender, 'parent'),
                    'child_role' => ($validated['relationship'] ?? null)
                        ?: Resident::roleLabel($relative->gender, 'child'),
                ]]);

                $notes[] = 'Also recorded as a child of ' . $otherParent->full_name . '.';
            }
        }

        return $this->success(
            ['family_notes' => $notes],
            $this->linkMessage($resident, $relative, $validated['relation'], $notes, null)
        );
    }

    /** Removes a family link that was recorded in error. */
    public function destroy(Request $request, Resident $resident, Resident $relative): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $relation = $request->query('relation');

        if (!in_array($relation, ['parent', 'child', 'spouse', 'guardian'], true)) {
            return $this->error('Specify which link to remove: parent, child, spouse or guardian', 422);
        }

        /*
         * Removing a guardianship DELETES it, because this is the undo for
         * one recorded against the wrong person. An arrangement that genuinely
         * came to an end is ended instead, which keeps the row — a child's
         * care history is exactly what gets asked about years later.
         */
        if ($relation === 'guardian') {
            Guardianship::where('ward_id', $resident->id)
                ->where('guardian_id', $relative->id)
                ->whereNull('ended_on')
                ->delete();

            return $this->success(null, 'Guardianship removed');
        }

        if ($relation === 'spouse') {
            // Marriage is mutual, so both sides have to be cleared.
            $resident->forceFill(['spouse_id' => null])->save();
            $relative->forceFill(['spouse_id' => null])->save();
        } elseif ($relation === 'parent') {
            $resident->parents()->detach($relative->id);
        } else {
            $resident->children()->detach($relative->id);
        }

        return $this->success(null, 'Family link removed');
    }
}
