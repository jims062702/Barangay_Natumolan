<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Http\Controllers\Api\Resident\Concerns\LinksFamily;
use App\Http\Controllers\Api\Resident\Concerns\RegistersResidents;
use App\Models\Household\Household;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Services\Account\PortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A whole household in one submission — the shape a house-to-house visit
 * actually produces.
 */
class HouseholdIntakeController extends BaseController
{
    use GuardsRegistry, LinksFamily, RegistersResidents;

    /**
     * Registers a whole household in one go.
     *
     * This is how the register is actually filled. A BHW walks to a house,
     * the owner answers the door, and the owner names everybody living
     * there — one visit, one conversation, one list. Registering the owner
     * and then opening their profile to add each person separately turns
     * one visit into six forms, and the six are what get abandoned halfway.
     *
     * The head is created first, then each member is passed through the SAME
     * family endpoint the profile uses. Nothing here is a second
     * implementation: the spouse rule still attaches a child to both parents,
     * the guardianship rules still hold, the namesake check still fires.
     *
     * A member may also be linked to NOBODY — "Other household member". A
     * grandchild in a lolo's house is not the lolo's child, and forcing a
     * relation that fits the form rather than the family is worse than
     * leaving it for the office to record properly afterwards. They are
     * still registered, still in the household, still counted.
     *
     * All of it in one transaction. A half-registered household — the owner
     * on the register and three of the five children missing — is the worst
     * possible outcome, because nobody can tell by looking which three.
     */
    /**
     * Passed as the "other parent" when the clerk says there is not one.
     *
     * Null cannot say it: null already means "nobody has told us", which is
     * what lets link() fall back to the spouse. "There is no second parent"
     * is a different answer and has to survive as one.
     */
    private const NO_OTHER_PARENT = -1;

    public function store(Request $request): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $request->validate([
            'head' => 'required|array',
            'members' => 'nullable|array',
            'members.*.relation' => 'required|in:spouse,child,parent,none',
            'members.*.other_parent' => 'nullable|array',
            'members.*.other_parent.kind' => 'required_with:members.*.other_parent|in:spouse,resident,outside,none',
            'members.*.other_parent.resident_id' => 'nullable|integer|exists:residents,id',
            'members.*.union_type' => 'nullable|in:' . implode(',', Marriage::UNION_TYPES),
            'make_household_head' => 'boolean',
        ]);

        $headData = $request->input('head');
        $members = $request->input('members', []);

        /*
         * Every person is validated BEFORE anybody is created. A household
         * that fails on the fifth member should not leave four behind, and
         * finding out one at a time is how that happens.
         */
        $headValidator = validator($headData, $this->residentRules());

        if ($headValidator->fails()) {
            return $this->error(
                'The household owner\'s details need attention.',
                422,
                ['head' => $headValidator->errors()->toArray()]
            );
        }

        foreach ($members as $index => $member) {
            $rules = ($member['record_type'] ?? null) === Resident::NON_RESIDENT
                ? $this->nonResidentRules()
                : $this->residentRules();

            $check = validator($member, $rules);

            // A parent living outside is created too, so their details are
            // checked here — with everybody else's, before the transaction
            // opens. Finding out halfway through is what leaves half a
            // household behind.
            if (($member['other_parent']['kind'] ?? null) === 'outside') {
                $parentCheck = validator($member['other_parent'], $this->nonResidentRules());

                if ($parentCheck->fails()) {
                    return $this->error(
                        'The other parent of member ' . ($index + 1) . ' needs attention.',
                        422,
                        ['members' => [$index => ['other_parent' => $parentCheck->errors()->toArray()]]]
                    );
                }
            }

            if ($check->fails()) {
                $name = trim(($member['first_name'] ?? '') . ' ' . ($member['last_name'] ?? ''));

                return $this->error(
                    ($name !== '' ? $name : 'Member ' . ($index + 1)) . ' needs attention.',
                    422,
                    ['members' => [$index => $check->errors()->toArray()]]
                );
            }
        }

        /*
         * Duplicates, for the WHOLE household at once.
         *
         * The single-resident form pauses on each namesake and asks. Six
         * of those in a row is a form nobody finishes, and worse, the
         * clerk answers the fourth one without reading it. So every
         * possible match is gathered here and shown together on the
         * preview — one look, one decision, before anybody is created.
         */
        if (!$request->boolean('confirm_namesakes')) {
            $found = [];

            foreach (array_merge([$headData], $members) as $index => $candidate) {
                $matches = $this->possibleDuplicates([
                    'first_name' => $candidate['first_name'] ?? '',
                    'last_name' => $candidate['last_name'] ?? '',
                    'birthdate' => $candidate['birthdate'] ?? null,
                    'mother_maiden_name' => $candidate['mother_maiden_name'] ?? null,
                ]);

                if ($matches->isNotEmpty()) {
                    $found[] = [
                        'index' => $index,
                        'who' => $index === 0 ? 'Household owner' : 'Member ' . $index,
                        'name' => trim(($candidate['first_name'] ?? '') . ' ' . ($candidate['last_name'] ?? '')),
                        'namesakes' => $matches,
                    ];
                }
            }

            if ($found !== []) {
                return $this->error(
                    count($found) === 1
                        ? $found[0]['name'] . ' may already be on the register.'
                        : count($found) . ' of these people may already be on the register.',
                    409,
                    ['possible_duplicates' => $found]
                );
            }
        }

        $result = DB::transaction(function () use ($headData, $members, $request) {
            $head = $this->createResident(
                validator($headData, $this->residentRules())->validated()
                + ['confirm_namesake' => true]
            );

            // The owner of the house, when the form said so. Through
            // handOverTo so the house keeps a record of who owned it before
            // — a BHW registering a household often finds a new owner in a
            // house the register still credits to a parent.
            if ($request->boolean('make_household_head') && $head->household_id) {
                Household::find($head->household_id)?->handOverTo(
                    $head,
                    'Correction of record',
                    'Recorded during household registration.'
                );
            }

            $headAccount = PortalAccount::provision($head, auth()->id());
            $registered = [];
            $notes = [];

            /*
             * The partner is created before any child.
             *
             * A child is attached to the owner's partner as well as the
             * owner, which cannot happen if the partner does not exist yet.
             * The clerk enters a household in whatever order the owner says
             * it — "my two sons, and my wife" is how people talk — and
             * whether the children come out belonging to their mother should
             * not depend on that. PHP's sort is stable, so everything else
             * keeps the order it was typed in.
             */
            usort($members, fn ($a, $b) =>
                (($a['relation'] ?? '') === 'spouse' ? 0 : 1)
                <=> (($b['relation'] ?? '') === 'spouse' ? 0 : 1));

            foreach ($members as $member) {
                $relation = $member['relation'];
                unset($member['relation']);

                $isNonResident = ($member['record_type'] ?? null) === Resident::NON_RESIDENT;
                $data = validator(
                    $member,
                    $isNonResident ? $this->nonResidentRules() : $this->residentRules()
                )->validated();

                unset($data['confirm_namesake']);

                if ($isNonResident) {
                    $data['record_type'] = Resident::NON_RESIDENT;
                } else {
                    // Everybody in the house shares the house, unless told otherwise.
                    $data['household_id'] = $data['household_id'] ?? $head->household_id;
                    $data['zone_purok'] = $data['zone_purok'] ?: $head->zone_purok;
                }

                $person = $this->createResident($data);

                /*
                 * Who the second parent is, when the clerk said.
                 *
                 * Unanswered, link() keeps its own presumption that the
                 * owner's partner is the other parent — right for most
                 * households and wrong for the ones that matter, which is
                 * why the form now asks.
                 */
                $namedParent = null;
                $otherParentId = null;
                $kind = $relation === 'child' ? ($member['other_parent']['kind'] ?? null) : null;

                if ($kind === 'resident') {
                    $namedParent = Resident::find($member['other_parent']['resident_id']);
                } elseif ($kind === 'outside') {
                    // A parent living elsewhere is recorded lightly: a name and
                    // a contact, so the child's parentage is complete without
                    // counting them in the population.
                    $namedParent = $this->createResident(
                        validator($member['other_parent'], $this->nonResidentRules())->validated()
                        + ['record_type' => Resident::NON_RESIDENT]
                    );
                }

                if ($namedParent) {
                    $otherParentId = $namedParent->id;
                } elseif ($kind === 'none') {
                    // "There is no second parent" — said, not merely unsaid,
                    // so the spouse presumption must not fill the gap.
                    $otherParentId = self::NO_OTHER_PARENT;
                }
                // 'spouse', or no answer at all, leaves it null: link() then
                // attaches the child to the owner's partner, as before.

                if ($relation !== 'none') {
                    $notes = array_merge(
                        $notes,
                        $this->link(
                            $head,
                            $person,
                            $relation,
                            $member['relationship'] ?? null,
                            // Two people living together are partners, not a
                            // husband and a wife. Recording every intake as
                            // 'Married' put the wrong word on their record and
                            // is the same error as setting their civil status
                            // to Married would be.
                            $member['union_type'] ?? 'Married',
                            $otherParentId
                        )
                    );
                }

                /*
                 * Attached directly, not through link() — going back through
                 * it would apply the spouse presumption a second time, from
                 * the other parent's side, and hand the child a third parent.
                 */
                if ($namedParent && $namedParent->id !== $head->id) {
                    $namedParent->children()->syncWithoutDetaching([$person->id => [
                        'parent_role' => Resident::roleLabel($namedParent->gender, 'parent'),
                        'child_role' => Resident::roleLabel($person->gender, 'child'),
                    ]]);

                    $notes[] = $namedParent->full_name . ' is recorded as '
                        . $person->full_name . "'s other parent.";
                }

                $account = PortalAccount::provision($person, auth()->id());

                $registered[] = [
                    'id' => $person->id,
                    'resident_number' => $person->resident_number,
                    'name' => $person->full_name,
                    'relation' => $relation,
                    'portal_account_created' => $account['created'],
                ];
            }

            return [
                'head' => [
                    'id' => $head->id,
                    'resident_number' => $head->resident_number,
                    'name' => $head->full_name,
                    'portal_account_created' => $headAccount['created'],
                ],
                'members' => $registered,
                'family_notes' => $notes,
            ];
        });

        $count = count($result['members']) + 1;

        return $this->success(
            $result,
            $count === 1
                ? $result['head']['name'] . ' was registered.'
                : $count . ' people registered in one household, starting with '
                    . $result['head']['name'] . '.',
            201
        );
    }
}
