<?php

namespace App\Http\Controllers\Api\Resident\Concerns;

use App\Models\Resident\Resident;

/**
 * A person's family, laid out the way the profile page reads it.
 */
trait DescribesFamily
{
    /** @return \Illuminate\Support\Collection<int,array> */
    private function cards($people, string $kind)
    {
        return collect($people)->map(fn ($person) => $this->card($person, $kind))->values();
    }

    /**
     * One family card, labelled for the group it is being shown in.
     *
     * A stored parent/child link carries a word for each end; everyone else is
     * labelled from their sex. Getting this wrong is what put "Son" beside a
     * resident's own father.
     */
    private function card($person, string $kind): ?array
    {
        if (!$person) {
            return null;
        }

        $stored = match ($kind) {
            'parent' => $person->pivot?->parent_role,
            'child' => $person->pivot?->child_role,
            // Lola, Tita, neighbour — the word for a carer is never a parent
            // word, and never derived from their sex.
            'guardian', 'ward' => $person->pivot?->relation,
            default => null,
        };

        $card = $person->only($this->familyCardFields())
            + ['relationship' => $stored ?: Resident::roleLabel($person->gender, $kind)];

        /*
         * A care arrangement has facts a plain family card has nowhere to put:
         * why the parents are not raising them, since when, and whether this
         * is the person to call first.
         */
        if (in_array($kind, ['guardian', 'ward'], true) && $person->pivot) {
            $card['guardianship'] = [
                'id' => $person->pivot->id,
                'reason' => $person->pivot->reason,
                'started_on' => $person->pivot->started_on,
                'is_primary' => (bool) $person->pivot->is_primary,
                'note' => $person->pivot->note,
            ];
        }

        return $card;
    }

    /*
    |--------------------------------------------------------------------------
    | Family
    |--------------------------------------------------------------------------
    | Parents, children and a spouse are captured as FULL resident records —
    | the same form, the same validation, the same automatic portal account —
    | because a mother entered as a name on her son's record is not in the
    | registry at all. Linking is what makes a household traceable in both
    | directions, and it is what gives a child their lola and lolo for free:
    | grandparents are simply the parents of their parents.
    */

    /** The identity fields a family card shows. */
    private function familyCardFields(): array
    {
        return ['id', 'resident_number', 'record_type', 'first_name', 'middle_name', 'last_name',
            'suffix', 'gender', 'birthdate', 'zone_purok', 'address', 'contact_number',
            'is_active', 'life_status', 'date_of_death'];
    }

    /**
     * Parents, children and spouse — with the step relationships kept in
     * their own groups rather than mixed in among them.
     *
     * A step-mother on a child's record is true and belongs there. Listing her
     * under "Parents" beside the mother is not: it reads as a claim about who
     * bore the child, and it is the claim the whole remarriage case turns on.
     */
    private function bloodline(Resident $resident): array
    {
        return [
            'parents' => $this->cards($resident->bloodParents(), 'parent'),
            'children' => $this->cards($resident->bloodChildren(), 'child'),
            'spouse' => $this->spouseCard($resident),
        ];
    }

    /**
     * The partner card, labelled for the KIND of union it is.
     *
     * "Husband" and "Wife" say married. Two people living together are
     * partners, and printing the wrong word on the family page is the same
     * error as setting their civil status to Married would be.
     */
    private function spouseCard(Resident $resident): ?array
    {
        $card = $this->card($resident->spouse, 'spouse');

        if (!$card) {
            return null;
        }

        $union = $resident->currentMarriage();

        $card['union_type'] = $union?->union_type;

        if ($union?->isLiveIn()) {
            $card['relationship'] = 'Partner (live-in)';
        }

        return $card;
    }

    /**
     * The half of the family nobody types in: grandparents, siblings, aunts
     * and uncles, and cousins are all read back off the parent/child join, so
     * recording one grandparent makes a whole side of the family appear.
     */
    private function derivedRelatives(Resident $resident): array
    {
        return [
            'grandparents' => $this->cards($resident->grandparents(), 'grandparent'),
            /*
             * Half-brothers and half-sisters are named as such where the
             * register can prove it — a second family is exactly the case
             * this matters in, and "Brother" would flatten it.
             */
            'siblings' => collect($resident->siblings())
                ->map(fn ($sibling) => $this->card($sibling, $resident->siblingKind($sibling)))
                ->values(),
            'aunts_uncles' => $this->cards($resident->auntsAndUncles(), 'aunt_uncle'),
            'cousins' => $this->cards($resident->cousins(), 'cousin'),
            'parents_note' => $resident->parentsMarriageNote(),
        ];
    }

    /**
     * Who is raising this child, whom this resident is raising, and the one
     * sentence a clerk needs about it.
     *
     * Kept apart from the derived relatives on purpose: nothing here is worked
     * out from anything. Guardianship is a fact somebody has to record, and
     * the whole point of the note below is to say so out loud when nobody has.
     */
    private function careArrangements(Resident $resident): array
    {
        return [
            'guardians' => $this->cards($resident->guardians, 'guardian'),
            'wards' => $this->cards($resident->wards, 'ward'),
            'past_guardians' => $this->pastGuardians($resident),
            'care_note' => $this->careNote($resident),
        ];
    }

    /** Arrangements that have ended — a child's care history is asked about. */
    private function pastGuardians(Resident $resident)
    {
        return $resident->guardianships()
            ->whereNotNull('ended_on')
            ->with('guardian:id,first_name,middle_name,last_name,suffix,gender')
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->guardian?->full_name,
                'guardian_id' => $row->guardian_id,
                'relation' => $row->relation,
                'reason' => $row->reason,
                'started_on' => $row->started_on?->toDateString(),
                'ended_on' => $row->ended_on?->toDateString(),
                'end_reason' => $row->end_reason,
            ])
            ->values();
    }

    /**
     * The sentence that turns a gap in the register into something a clerk
     * can act on.
     *
     * The case it exists for: a child registered here as a bona fide resident
     * whose mother and father are both recorded outside the barangay. The
     * record looks complete — parents named, household set — while the one
     * thing the barangay actually needs, WHO TO KNOCK FOR, is nowhere on it.
     * Silence is the wrong answer, so the profile says it plainly.
     */
    private function careNote(Resident $resident): ?array
    {
        $guardians = $resident->guardians;

        if ($guardians->isNotEmpty()) {
            $primary = $guardians->firstWhere('pivot.is_primary', true) ?? $guardians->first();
            $relation = $primary->pivot?->relation;
            $reason = $primary->pivot?->reason;

            return [
                'kind' => 'recorded',
                'text' => 'In the care of ' . $primary->full_name
                    . ($relation ? ' (' . $relation . ')' : '')
                    . ($reason ? ' — ' . lcfirst($reason) : '') . '.',
            ];
        }

        // Not a minor, or a parent is here to raise them: nothing to flag.
        if (!$resident->isMinor() || !$resident->parentsAreAway()) {
            return null;
        }

        $away = $resident->parents
            ->map(fn ($parent) => $parent->isDeceased()
                ? $parent->full_name . ' has passed away'
                : $parent->full_name . ' lives outside the barangay')
            ->join('; ');

        return [
            'kind' => 'missing',
            'text' => 'Nobody is recorded as raising ' . $resident->first_name . '. ' . $away
                . '. Record the lola, tita or whoever the child lives with, so the barangay '
                . 'knows who to reach and who signs for them.',
        ];
    }
}
