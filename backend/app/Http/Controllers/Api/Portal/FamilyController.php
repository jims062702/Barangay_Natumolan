<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Resident\Resident;

class FamilyController extends PortalController
{
    /**
     * The resident's family as recorded in the registry: their parents, their
     * parents' parents (lola/lolo), their spouse, their children and their
     * siblings. Read-only, because the Population Office owns the registry:
     * the portal only lets a resident see who they are connected to.
     */
    public function show()
    {
        $resident = Resident::with([
            // `parents.parents.children.children` is what produces the aunts,
            // uncles and cousins below without storing any of them.
            'parents.parents.children.children',
            'parents.children',
            'children',
            'spouse',
            // Who is raising them, and whom they are raising. A guardian is
            // not on the family tree — they are the person at the door.
            'guardians',
            'wards',
        ])->find($this->residentId());

        if (!$resident) {
            return $this->notFound('No resident record is linked to your account');
        }

        /*
         * Each group gets the word that is true FROM THE RESIDENT'S SIDE. A
         * parent/child link stores one word for each end, and everyone else
         * is named from their sex — otherwise a resident's own father shows
         * up on their profile labelled "Son", which is what used to happen.
         */
        $card = fn ($person, string $kind) => $person === null ? null : [
            'id' => $person->id,
            'full_name' => $person->full_name,
            'gender' => $person->gender,
            'birthdate' => $person->birthdate?->toDateString(),
            'age' => $person->birthdate?->age,
            'zone_purok' => $person->zone_purok,
            'relationship' => match ($kind) {
                'parent' => $person->pivot?->parent_role,
                'child' => $person->pivot?->child_role,
                'guardian', 'ward' => $person->pivot?->relation,
                default => null,
            } ?: Resident::roleLabel($person->gender, $kind),
        ];

        $cards = fn ($people, string $kind) => collect($people)
            ->map(fn ($person) => $card($person, $kind))->values();

        return $this->success([
            'self' => $card($resident, 'self'),
            /*
             * A step-parent is kept in their own group. Listing them under
             * "Parents" reads as a claim about who bore this resident, which
             * is not what a remarriage says.
             */
            'parents' => $cards($resident->bloodParents(), 'parent'),
            'grandparents' => $cards($resident->grandparents(), 'grandparent'),
            // Labelled for the kind of union: a live-in partner is not a
            // "Husband" or a "Wife".
            'spouse' => (function () use ($resident, $card) {
                $built = $card($resident->spouse, 'spouse');

                if ($built && $resident->currentMarriage()?->isLiveIn()) {
                    $built['relationship'] = 'Partner (live-in)';
                }

                return $built;
            })(),
            'children' => $cards($resident->bloodChildren(), 'child'),
            // Half-brothers and half-sisters named as such where it is known.
            'siblings' => collect($resident->siblings())
                ->map(fn ($sibling) => $card($sibling, $resident->siblingKind($sibling)))
                ->values(),
            'aunts_uncles' => $cards($resident->auntsAndUncles(), 'aunt_uncle'),
            'cousins' => $cards($resident->cousins(), 'cousin'),
            /*
             * Care, not descent. Shown to the resident because they are often
             * the one who has to say who their guardian is at a counter, and
             * because a young resident living with a lola should be able to
             * see that the barangay has it right.
             */
            'guardians' => $cards($resident->guardians, 'guardian'),
            'wards' => $cards($resident->wards, 'ward'),
            // Only present when the family agreed the children may see it.
            'parents_note' => $resident->parentsMarriageNote(),
        ], 'Family retrieved');
    }
}
