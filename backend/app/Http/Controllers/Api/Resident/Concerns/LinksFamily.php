<?php

namespace App\Http\Controllers\Api\Resident\Concerns;

use App\Models\Resident\Guardianship;
use App\Models\Resident\Resident;
use App\Support\ManilaTime;

/**
 * Recording how people are related: parents and children, partners, and
 * who is raising a child when the parents are not.
 */
trait LinksFamily
{
    /**
     * Writes the link, and with it the consequences a clerk would otherwise
     * have to remember:
     *
     *   - a child added to one parent is also the child of that parent's
     *     spouse, because that is what a married couple's child is;
     *   - a newly recorded spouse inherits the children already on the record,
     *     for the same reason.
     *
     * Returns a plain-language list of what else changed, so the clerk sees
     * the tree the system just built rather than having to go looking.
     *
     * @return string[]
     */
    private function link(
        Resident $resident,
        Resident $relative,
        string $relation,
        ?string $label,
        string $unionType = 'Married',
        ?int $otherParentId = null,
        array $guardian = [],
        // 'shared' | null — whether the partner's existing children are this
        // new spouse's too. Null means "leave them alone".
        ?string $childrenAre = null
    ): array {
        $notes = [];

        /*
         * Nowhere near the parent/child join. Everything below derives family
         * from that table, and a carer written into it would be read back as
         * blood: her children as the ward's siblings, her parents as the
         * ward's grandparents.
         */
        if ($relation === 'guardian') {
            return $this->recordGuardianship($resident, $relative, $label, $guardian);
        }

        if ($relation === 'parent') {
            // The clerk chose a word for the PARENT; the child's own word is
            // derived, so the link reads correctly from either end.
            $resident->parents()->syncWithoutDetaching([$relative->id => [
                'parent_role' => $label ?: Resident::roleLabel($relative->gender, 'parent'),
                'child_role' => Resident::roleLabel($resident->gender, 'child'),
            ]]);

            return $notes;
        }

        if ($relation === 'child') {
            // Here the chosen word describes the CHILD, and the parent's is
            // the derived one — the mirror of the case above.
            $roles = [
                'parent_role' => Resident::roleLabel($resident->gender, 'parent'),
                'child_role' => $label ?: Resident::roleLabel($relative->gender, 'child'),
            ];

            $resident->children()->syncWithoutDetaching([$relative->id => $roles]);

            /*
             * The spouse is presumed to be the other parent — but only while
             * nobody has said otherwise. When the clerk names a DIFFERENT
             * other parent, that is a statement that this child is not the
             * spouse's, and attaching them anyway would put a child on the
             * record of someone who is not their parent.
             */
            $spouseIsTheOtherParent = $otherParentId === null
                || $otherParentId === $resident->spouse_id;

            if ($resident->spouse && $spouseIsTheOtherParent) {
                $resident->spouse->children()->syncWithoutDetaching([$relative->id => [
                    'parent_role' => Resident::roleLabel($resident->spouse->gender, 'parent'),
                    'child_role' => $roles['child_role'],
                ]]);
                $notes[] = 'Also recorded as a child of ' . $resident->spouse->full_name . '.';
            }

            return $notes;
        }

        $union = $resident->marryTo($relative, null, $unionType);

        /*
         * Marriage is a statement about civil status; living together is not.
         * Setting both partners to "Married" for a live-in union would be
         * recording something legally untrue about them.
         */
        if (!$union->isLiveIn()) {
            foreach ([$resident, $relative] as $person) {
                if ($person->civil_status !== 'Married') {
                    $person->forceFill(['civil_status' => 'Married'])->save();
                }
            }
        } else {
            $notes[] = 'Recorded as partners, not married — their civil status is unchanged.';
        }

        /*
         * Children already on either record. Neither side is touched unless
         * the clerk asked for it, and the answer given about ONE partner's
         * children says nothing about the other's — so it is not applied to
         * them. The new spouse is linked to the spouse, and to nobody else.
         */
        $notes = array_merge(
            $notes,
            $this->attachChildrenToNewSpouse($resident, $relative, $childrenAre),
            $this->attachChildrenToNewSpouse($relative, $resident, null)
        );

        /*
         * Solo Parent is a registration for someone raising children ALONE
         * (RA 8972), and it lapses on marrying or living in with a partner.
         * Leaving the tag standing would keep them on a benefits list they no
         * longer qualify for.
         */
        foreach ([$resident, $relative] as $person) {
            $tag = $person->sectors()
                ->where('sector_type', 'Solo Parent')
                ->where('is_active', true)
                ->first();

            if ($tag) {
                $tag->update([
                    'is_active' => false,
                    'unenrolled_date' => ManilaTime::today(),
                    'note' => 'Ended automatically: recorded as ' . strtolower($unionType)
                        . ' with ' . ($person->id === $resident->id ? $relative->full_name : $resident->full_name) . '.',
                ]);
                $notes[] = $person->full_name . ' is no longer tagged Solo Parent — that status is '
                    . 'for a parent raising children alone, and ends on marrying or living in.';
            }
        }

        return $notes;
    }

    /**
     * What a new marriage does to the children ALREADY on the partner's record.
     *
     * By default: nothing. A marriage is between two people, and the children
     * one of them already has are not part of the transaction. The commonest
     * case by far is a remarriage, where writing anything onto those children
     * is wrong — and the wrong thing was being written silently, so a second
     * wife came out recorded as the mother of the first wife's children.
     *
     * One thing can be asked for instead, and it is the clerk's to choose:
     *
     *   'shared' — a first marriage whose children were entered before the
     *              wedding was. The spouse really is the other parent, and
     *              attaching them saves entering every child a second time.
     *
     * It cannot give a child a third parent: two are already on the record,
     * and no answer at a counter changes who they are. A child who already
     * has both is left exactly as they are, and the clerk is told so.
     *
     * @return string[]
     */
    private function attachChildrenToNewSpouse(
        Resident $parent,
        Resident $newSpouse,
        ?string $childrenAre
    ): array {
        $children = $parent->bloodChildren();

        if ($children->isEmpty()) {
            return [];
        }

        // Nothing asked for, nothing written.
        if ($childrenAre !== 'shared') {
            return [
                $parent->full_name . "'s " . $children->count() . ' existing child record(s) were '
                    . 'left as they are — their own parents are unchanged.',
            ];
        }

        $shared = [];
        $refused = [];

        foreach ($children as $child) {
            // Already connected either way — leave whatever is recorded alone.
            if ($newSpouse->children()->where('residents.id', $child->id)->exists()) {
                continue;
            }

            /*
             * The one thing a clerk cannot ask for. A child with a mother
             * and a father on record is not acquiring a second mother
             * because somebody remarried — that child is left alone and the
             * clerk is told why.
             */
            $hasOtherParent = $child->bloodParents()
                ->reject(fn ($p) => $p->id === $parent->id)
                ->isNotEmpty();

            if ($hasOtherParent) {
                $refused[] = $child->full_name;
                continue;
            }

            $newSpouse->children()->syncWithoutDetaching([$child->id => [
                'parent_role' => Resident::roleLabel($newSpouse->gender, 'parent'),
                'child_role' => Resident::roleLabel($child->gender, 'child'),
            ]]);

            $shared[] = $child->full_name;
        }

        $notes = [];

        if ($shared !== []) {
            $notes[] = count($shared) . ' existing child record(s) now also list '
                . $newSpouse->full_name . ' as a parent.';
        }

        if ($refused !== []) {
            $notes[] = implode(', ', $refused)
                . (count($refused) === 1 ? ' already has' : ' already have')
                . ' both parents on record and were left unchanged — '
                . $newSpouse->full_name . ' was not added to them.';
        }

        return $notes;
    }

    /**
     * Writes down that this child is being raised by this person.
     *
     * $resident is the ward and $relative the guardian, matching the way
     * every other link on this page reads: the person whose profile the clerk
     * is standing on comes first.
     */
    private function recordGuardianship(Resident $ward, Resident $guardian, ?string $relation, array $details): array
    {
        $notes = [];
        $isPrimary = $details['is_primary'] ?? true;

        /*
         * One name to call first. A child left with a couple has two guardians
         * and only one of them answers the phone, and silently letting the
         * most recent entry win is how the barangay rings the wrong person.
         */
        if ($isPrimary) {
            Guardianship::where('ward_id', $ward->id)
                ->whereNull('ended_on')
                ->update(['is_primary' => false]);
        }

        Guardianship::create([
            'ward_id' => $ward->id,
            'guardian_id' => $guardian->id,
            'relation' => $relation ?: null,
            'reason' => $details['reason'] ?? null,
            'started_on' => $details['started_on'] ?? null,
            'is_primary' => $isPrimary,
            'note' => $details['note'] ?? null,
            'recorded_by' => auth()->id(),
        ]);

        if ($isPrimary) {
            $notes[] = $guardian->full_name . ' is now the person the barangay contacts about '
                . $ward->first_name . '.';
        }

        /*
         * A child is normally registered into the house they actually sleep
         * in. When the guardian's household is a different one, one of the two
         * records is wrong, and it is far cheaper to say so now than to find
         * out during a house-to-house.
         */
        if ($ward->household_id && $guardian->household_id
            && $ward->household_id !== $guardian->household_id) {
            $notes[] = 'Note: ' . $ward->first_name . ' is recorded in a different household from '
                . $guardian->full_name . '. Check which house the child actually lives in.';
        }

        if ($ward->parentsAreAway()) {
            $notes[] = 'Both parents are recorded away from the barangay, so this is now the '
                . 'only contact on the child\'s record.';
        }

        return $notes;
    }

    /** One sentence describing what the clerk just did. */
    private function linkMessage(Resident $resident, Resident $relative, string $relation, array $notes, ?array $account): string
    {
        $message = $relation === 'guardian'
            // Not "the guardian OF": a carer is doing something, not holding
            // a position on a family tree.
            ? $relative->full_name . ' is now recorded as raising ' . $resident->full_name . '.'
            : $relative->full_name . ' is now recorded as the '
                . ['parent' => 'parent', 'child' => 'child', 'spouse' => 'spouse'][$relation]
                . ' of ' . $resident->full_name . '.';

        if ($notes !== []) {
            $message .= ' ' . implode(' ', $notes);
        }

        if ($account && $account['created']) {
            $message .= ' A portal account was created and emailed to them.';
        }

        return $message;
    }

    /**
     * Why a link cannot be made. Kept separate from making it so both the
     * "add new" and "link existing" paths refuse the same things.
     */
    private function linkBlocker(Resident $resident, Resident $relative, string $relation): ?string
    {
        if ($relation === 'guardian') {
            /*
             * A parent raising their own child is not a guardianship — the
             * parent link already says it. Allowing both would put the same
             * person on the profile twice, in two roles, and leave the clerk
             * to work out which one the barangay means.
             */
            if ($resident->parents()->where('residents.id', $relative->id)->exists()) {
                return $relative->full_name . ' is recorded as ' . $resident->full_name
                    . "'s parent, so they do not also need to be recorded as their guardian.";
            }

            if (Guardianship::where('ward_id', $resident->id)
                ->where('guardian_id', $relative->id)
                ->whereNull('ended_on')->exists()) {
                return $relative->full_name . ' is already recorded as raising '
                    . $resident->full_name . '.';
            }

            // Two people cannot each be raising the other.
            if (Guardianship::where('ward_id', $relative->id)
                ->where('guardian_id', $resident->id)
                ->whereNull('ended_on')->exists()) {
                return $resident->full_name . ' is already recorded as raising '
                    . $relative->full_name . ', so it cannot also be the other way round.';
            }

            return null;
        }

        if ($relation === 'spouse') {
            if ($resident->spouse_id && $resident->spouse_id !== $relative->id) {
                return $resident->full_name . ' is already recorded as married to someone else.';
            }
            if ($relative->spouse_id && $relative->spouse_id !== $resident->id) {
                return $relative->full_name . ' is already recorded as married to someone else.';
            }

            return null;
        }

        // A person cannot be their own ancestor: without this, one mistaken
        // click makes the family tree infinite and every page that walks it
        // hangs.
        [$child, $parent] = $relation === 'parent' ? [$resident, $relative] : [$relative, $resident];

        if ($this->isDescendant($parent, $child)) {
            return $parent->full_name . ' is already recorded below ' . $child->full_name
                . ' in the family tree, so this link would loop.';
        }

        return null;
    }

    /** Whether $person appears anywhere below $ancestor in the tree. */
    private function isDescendant(Resident $person, Resident $ancestor, int $depth = 0): bool
    {
        if ($person->id === $ancestor->id) {
            return true;
        }

        // Six generations is far more than a barangay register ever holds;
        // the limit is a stop against corrupt data, not a modelling choice.
        if ($depth >= 6) {
            return false;
        }

        foreach ($ancestor->children as $child) {
            if ($this->isDescendant($person, $child, $depth + 1)) {
                return true;
            }
        }

        return false;
    }
}
