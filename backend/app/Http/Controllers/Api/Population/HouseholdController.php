<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Population\ChangeHouseholdOwnerRequest;
use App\Http\Requests\Population\StoreHouseholdRequest;
use App\Http\Requests\Population\UpdateHouseholdRequest;
use App\Models\Household\Household;
use App\Models\Household\OwnerChange;
use App\Models\Resident\Resident;
use App\Services\Content\LandingCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Households: the houses on the register, and who owns each. */
class HouseholdController extends BaseController
{
    public function index(Request $request)
    {
        /*
         * Enough of each person to answer "who is in this house?" — which is
         * a name, a sex, an age and what they are to the head. A list of bare
         * names answers none of it: two Juan Dela Cruzes in one household are
         * indistinguishable, and nothing says which is the child.
         *
         * `parents` and `spouse_id` come along because the relationship is
         * derived from them rather than stored twice.
         */
        $query = Household::with([
            'residents:id,household_id,resident_number,first_name,middle_name,last_name,suffix,gender,birthdate,spouse_id',
            'residents.parents:id',
            'head:id,first_name,middle_name,last_name,suffix',
            /*
             * The census sheet this household came from.
             *
             * On the registry rather than in a list of its own: the two were
             * the same households reached two ways — the form number IS the
             * household number — and the office had to know which list
             * carried the answer.
             */
            'census:id,household_id,census_no,status,created_at,recorded_by',
            'census.recorder:id,name',
        ]);

        if ($request->filled('zone_purok')) {
            $query->where('zone_purok', $request->zone_purok);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('household_number', 'like', "%{$search}%")
                  ->orWhere('street_address', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate(20);

        /*
         * What each person is to the head, worked out from the family links
         * the register already holds. Only the ones the links actually say:
         * a spouse is a spouse and a child is a child, and everybody else is
         * left blank rather than guessed at — a household holds cousins,
         * boarders and grandparents, and the register does not claim to know
         * which without being told.
         */
        $page->getCollection()->transform(function (Household $household) {
            $headId = $household->household_head_id;

            $household->residents->each(function (Resident $person) use ($headId) {
                $person->relation_to_head = match (true) {
                    $person->id === $headId => 'Head',
                    $headId !== null && $person->spouse_id === $headId => 'Spouse',
                    $headId !== null && $person->parents->contains('id', $headId)
                        => Resident::roleLabel($person->gender, 'child'),
                    default => null,
                };

                // The join was only needed for the line above.
                $person->unsetRelation('parents');
            });

            return $household;
        });

        return $this->success($page, 'Households retrieved');
    }

    public function show(Household $household)
    {
        $household->load([
            'head',
            'residents' => fn ($q) => $q->whereNull('merged_into_id'),
        ]);

        return $this->success($household, 'Household details retrieved');
    }

    public function store(StoreHouseholdRequest $request)
    {
        $validated = $request->validated();

        // Created without the owner, then handed over — so the first owner
        // gets a history entry like every one after them, and the house has
        // a readable beginning rather than a name that was simply always
        // there.
        $firstOwner = $validated['household_head_id'] ?? null;
        $memberIds = $validated['member_ids'] ?? [];
        unset($validated['household_head_id'], $validated['member_ids']);

        $household = Household::create($validated);

        if ($firstOwner) {
            $head = Resident::find($firstOwner);
            if ($head) {
                $household->handOverTo($head);
                if ($household->zone_purok && empty($head->zone_purok)) {
                    $head->update(['zone_purok' => $household->zone_purok]);
                }
            }
        }

        if (!empty($memberIds)) {
            $members = Resident::whereIn('id', $memberIds)->get();
            foreach ($members as $member) {
                $updateData = ['household_id' => $household->id];
                if ($household->zone_purok && empty($member->zone_purok)) {
                    $updateData['zone_purok'] = $household->zone_purok;
                }
                $member->update($updateData);
            }
        }

        $household->update(['total_members' => $household->residents()->count()]);
        $household->load(['head:id,first_name,last_name', 'residents']);

        LandingCache::clearStats();

        return $this->success($household, 'Household created', 201);
    }

    public function update(UpdateHouseholdRequest $request, Household $household)
    {
        $validated = $request->validated();

        /*
         * The owner is NOT changed here.
         *
         * This form edits the house — its number, purok, address. Letting it
         * also swap the owner is how a hand-over happens with no reason
         * attached and no entry in the history: the same field, edited among
         * five others, with nobody asked why. Changing hands has its own
         * endpoint, which asks.
         */
        $attemptedOwner = array_key_exists('household_head_id', $validated) ? $validated['household_head_id'] : false;
        unset($validated['household_head_id']);

        $household->update($validated);

        if ($attemptedOwner !== false && (int) $attemptedOwner !== (int) $household->household_head_id) {
            $to = !empty($attemptedOwner) ? Resident::find($attemptedOwner) : null;
            $household->handOverTo(
                $to,
                'Updated via Edit Household',
                null,
                now()->toDateString()
            );
        }

        $household->load([
            'head:id,first_name,last_name',
            'residents:id,household_id,first_name,last_name',
        ]);

        return $this->success($household, 'Household updated');
    }

    /**
     * Set (or change) a household's owner/head. Used by the resident-
     * registration flow to make the just-registered resident the head of a
     * household they created inline (the resident didn't exist yet when the
     * household was created, so the owner is linked afterwards).
     */
    public function setHead(ChangeHouseholdOwnerRequest $request, Household $household)
    {
        $validated = $request->validated();

        $to = !empty($validated['household_head_id'])
            ? Resident::find($validated['household_head_id'])
            : null;

        /*
         * A house that already has an owner cannot change hands silently.
         *
         * Setting the FIRST owner needs no reason — nothing passed from
         * anybody. Replacing one does: "Sold" and "the owner died" leave
         * exactly the same value in the column and mean entirely different
         * things to the next clerk certifying who lives here. Without the
         * reason the register records that it happened and not what
         * happened, which is the half that gets asked about.
         */
        if ($household->household_head_id && empty($validated['reason'])) {
            return $this->error(
                'Say why the owner is changing — this house already has one ('
                    . ($household->head?->full_name ?? 'unknown') . ').',
                422,
                ['reason' => ['A reason is required when replacing an owner.']]
            );
        }

        $change = $household->handOverTo(
            $to,
            $validated['reason'] ?? null,
            $validated['note'] ?? null,
            $validated['changed_on'] ?? null
        );

        $household->load(['head:id,first_name,last_name', 'ownerChanges.from:id,first_name,last_name',
            'ownerChanges.to:id,first_name,last_name', 'ownerChanges.recorder:id,name']);

        return $this->success(
            $household,
            $change === null
                ? 'No change — that resident is already the owner.'
                : ($to
                    ? $to->full_name . ' is now the owner. The previous owner is kept in the history.'
                    : 'The house is now recorded without an owner, and the change is in the history.')
        );
    }

    /**
     * Every owner this house has had, newest first.
     *
     * Read separately from the household record because it grows without
     * limit and the list page has no use for it — a house sold three times
     * should not make the household index heavier for the ones sold none.
     */
    public function ownerHistory(Household $household)
    {
        $changes = $household->ownerChanges()
            ->with(['from:id,resident_number,first_name,last_name',
                    'to:id,resident_number,first_name,last_name',
                    'recorder:id,name'])
            ->get();

        return $this->success([
            'household' => $household->only(['id', 'household_number', 'street_address', 'zone_purok']),
            'current_owner' => $household->head?->only(['id', 'resident_number', 'first_name', 'last_name']),
            'changes' => $changes,
            'reasons' => OwnerChange::REASONS,
        ], 'Household owner history retrieved');
    }

    /**
     * Transfer one or more residents from their current households to a destination household,
     * or create a brand new household for them on the fly and designate the household head.
     */
    public function transferResident(Request $request)
    {
        // Support both single resident_id and array of resident_ids
        if ($request->has('resident_id') && !$request->has('resident_ids')) {
            $request->merge(['resident_ids' => [$request->input('resident_id')]]);
        }

        $validated = $request->validate([
            'resident_ids' => 'required|array|min:1',
            'resident_ids.*' => 'exists:residents,id',
            'head_resident_id' => 'nullable|exists:residents,id',
            'household_id' => 'nullable|required_without:new_household|exists:households,id',
            'new_household' => 'nullable|required_without:household_id|array',
            'new_household.household_number' => 'required_with:new_household|string|unique:households,household_number',
            'new_household.zone_purok' => 'required_with:new_household|string',
            'new_household.street_address' => 'required_with:new_household|string',
            'new_household.house_type' => 'nullable|string',
            'reason' => 'nullable|string|max:255',
            'sync_address' => 'nullable|boolean',
            'old_head_action' => 'nullable|string|in:retain,replace,unassign',
            'replacement_head_id' => 'nullable|exists:residents,id',
        ]);

        $residents = Resident::whereIn('id', $validated['resident_ids'])->get();
        if ($residents->isEmpty()) {
            return $this->error('No valid residents selected to transfer.', 422);
        }

        $newHousehold = DB::transaction(function () use ($validated, $residents) {
            if (!empty($validated['new_household'])) {
                $nhData = $validated['new_household'];
                $newHousehold = Household::create($nhData);
            } else {
                $newHousehold = Household::with('head')->findOrFail($validated['household_id']);
            }

            $headId = $validated['head_resident_id'] ?? null;
            // If new household and no head explicitly specified, default to first resident
            if (!$headId && !empty($validated['new_household']) && $residents->isNotEmpty()) {
                $headId = $residents->first()->id;
            }

            $oldHouseholdIds = [];
            $syncAddress = $validated['sync_address'] ?? true;
            $oldHeadAction = $validated['old_head_action'] ?? 'retain';
            $replacementHeadId = $validated['replacement_head_id'] ?? null;

            foreach ($residents as $resident) {
                $oldHouseholdId = $resident->household_id;
                if ($oldHouseholdId && $oldHouseholdId !== $newHousehold->id) {
                    $oldHouseholdIds[$oldHouseholdId] = true;
                    $oldHh = Household::find($oldHouseholdId);

                    // If this resident was the head of their old household
                    if ($oldHh && (int) $oldHh->household_head_id === (int) $resident->id) {
                        if ($oldHeadAction === 'replace' && $replacementHeadId) {
                            $replacer = Resident::find($replacementHeadId);
                            if ($replacer) {
                                $oldHh->handOverTo(
                                    $replacer,
                                    'Replacement Head',
                                    'Assigned new head as previous head (' . $resident->full_name . ') transferred to Household ' . $newHousehold->household_number
                                );
                            }
                        } elseif ($oldHeadAction === 'unassign') {
                            $oldHh->handOverTo(
                                null,
                                'Moved out',
                                'Transferred to Household ' . $newHousehold->household_number . (!empty($validated['reason']) ? ": {$validated['reason']}" : '')
                            );
                        }
                        // Note: If $oldHeadAction === 'retain' (or not unassigned/replaced),
                        // the resident remains the household_head_id (property owner) of $oldHh.
                        // In barangay records, a resident can own/head multiple households.
                    }
                }

                $updateData = ['household_id' => $newHousehold->id];
                if ($syncAddress) {
                    if ($newHousehold->zone_purok) {
                        $updateData['zone_purok'] = $newHousehold->zone_purok;
                    }
                    if ($newHousehold->street_address) {
                        $updateData['address'] = $newHousehold->street_address;
                    }
                }
                $resident->update($updateData);
            }

            // Set or hand over the head of the destination household if a head was designated
            if ($headId) {
                $headResident = $residents->firstWhere('id', $headId) ?? Resident::find($headId);
                if ($headResident) {
                    $newHousehold->handOverTo(
                        $headResident,
                        'Designated Head',
                        !empty($validated['reason']) ? $validated['reason'] : 'Assigned as Household Head during transfer.'
                    );
                }
            }

            // Keep total_members in sync for all affected old households
            foreach (array_keys($oldHouseholdIds) as $oldId) {
                $oldHh = Household::find($oldId);
                if ($oldHh) {
                    $oldHh->update(['total_members' => $oldHh->residents()->count()]);
                }
            }
            $newHousehold->update(['total_members' => $newHousehold->residents()->count()]);

            return $newHousehold;
        });

        LandingCache::clearStats();

        $count = $residents->count();
        $plural = $count === 1 ? 'resident' : 'residents';

        return $this->success([
            'transferred_count' => $count,
            'household' => $newHousehold->fresh(['residents', 'head']),
        ], "{$count} {$plural} successfully transferred to household {$newHousehold->household_number}.");
    }
}
