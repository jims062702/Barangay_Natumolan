<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\DescribesFamily;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Http\Controllers\Api\Resident\Concerns\RegistersResidents;
use App\Models\Chat\Conversation;
use App\Models\Household\Household;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Services\Content\LandingCache;
use App\Services\Account\PortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The resident register — the Population Office's own records.
 */
class ResidentController extends BaseController
{
    use DescribesFamily, GuardsRegistry, RegistersResidents;

    /**
     * Display all residents
     */
    public function index(Request $request): JsonResponse
    {
        // Merged-away records are tombstones pointing at the surviving
        // resident; they must never appear as people in their own right.
        $query = Resident::whereNull('merged_into_id')
            ->with([
                'household',
                'sectors' => fn ($q) => $q->where('is_active', true),
                // Only the parts needed to name them and pick the right word.
                'spouse:id,first_name,middle_name,last_name,suffix,gender',
            ]);

        /*
         * Non-residents are relatives who live elsewhere. They are on the
         * register so families can be recorded, not because the barangay
         * serves them, so the registry list leaves them out unless asked.
         */
        if ($request->input('record_type') === Resident::NON_RESIDENT) {
            /*
             * ONLY the people who live elsewhere. Their own list, because
             * they are a different question: a bona fide resident is looked
             * up by purok and sector, and a non-resident by the family they
             * belong to and the town they are in. Mixed together, the BPO
             * cannot count either of them.
             */
            $query->where('record_type', Resident::NON_RESIDENT);
        } elseif (!$request->boolean('include_non_residents')) {
            $query->bonafide();
        }

        if ($request->filled('search')) {
            // Same word-by-word matching as every other resident lookup, so
            // "Juan Dela Cruz" works here too.
            $query->nameSearch($request->input('search'));
        }

        if ($request->filled('zone_purok')) {
            $query->where('zone_purok', $request->input('zone_purok'));
        }

        if ($request->filled('gender')) {
            $query->where('gender', $request->input('gender'));
        }

        if ($request->filled('sector')) {
            $query->whereHas('sectors', function ($q) use ($request) {
                $q->where('sector_type', $request->input('sector'));
            });
        }
        
        if ($request->input('record_type') === Resident::NON_RESIDENT) {
            // Why they are on the register at all: the family that named them.
            $query->with([
                'children:id,first_name,last_name',
                'parents:id,first_name,last_name',
            ]);
        }

        $residents = $query->paginate(20);

        /*
         * What to call each partner, worked out for the whole page at once.
         *
         * "Wife" and "Husband" say married; two people living together are
         * partners. Telling them apart needs the union record, and asking for
         * it row by row would be twenty queries a page — so the open unions
         * for everybody on this page are fetched in one go.
         */
        $spouseIds = $residents->getCollection()
            ->pluck('spouse_id')->filter()->all();

        $liveIn = [];

        if ($spouseIds !== []) {
            $ids = $residents->getCollection()->pluck('id')->all();

            $openUnions = Marriage::open()
                ->where(fn ($q) => $q->whereIn('resident_id', $ids)->orWhereIn('spouse_id', $ids))
                ->get(['resident_id', 'spouse_id', 'union_type']);

            foreach ($openUnions as $union) {
                if ($union->isLiveIn()) {
                    $liveIn[$union->resident_id] = true;
                    $liveIn[$union->spouse_id] = true;
                }
            }
        }

        $residents->getCollection()->transform(function ($resident) use ($liveIn) {
            $row = $resident->toArray();

            if ($resident->spouse) {
                $row['spouse_label'] = isset($liveIn[$resident->id])
                    ? 'Partner'
                    : Resident::roleLabel($resident->spouse->gender, 'spouse');
            }

            return $row;
        });

        /*
         * Why this list and the public population figure differ.
         *
         * The office must still be able to find somebody who has died —
         * their record carries family links and is referenced by
         * certificates already issued — so the list shows them. The
         * population count must not: they are not living here.
         *
         * Both are right, and the gap between them looks like a bug until
         * somebody says out loud what it is. So the list says it.
         */
        return $this->success(
            $residents->toArray() + [
                'not_in_population' => Resident::whereNull('merged_into_id')
                    ->bonafide()
                    ->where('is_active', false)
                    ->count(),
            ],
            'Residents retrieved successfully'
        );
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        /*
         * A non-resident can be registered from here too — the commonest case
         * being a child's other parent who lives elsewhere and is not on the
         * register at all. Five fields, no portal account, not counted.
         */
        $isNonResident = $request->input('record_type') === Resident::NON_RESIDENT;

        $validated = $request->validate(
            $isNonResident ? $this->nonResidentRules() : $this->residentRules(),
            ['email.unique' => 'This email is already registered to another resident.']
        );

        if ($conflict = $this->namesakeCheck($request, $validated)) {
            return $conflict;
        }

        if ($isNonResident) {
            $validated['record_type'] = Resident::NON_RESIDENT;
        }

        $resident = $this->createResident($validated);

        /*
         * Registering a resident IS issuing their portal account. The BPO
         * used to create logins one at a time from each profile page, so most
         * residents never got one; now the account exists from the moment the
         * record does, and the resident activates it themselves with a code
         * emailed to them at first sign-in.
         */
        $account = PortalAccount::provision($resident, auth()->id());

        return $this->success(
            $this->withAccountNotice($resident, $account),
            $isNonResident
                ? $resident->full_name . ' was recorded as living outside the barangay.'
                : ($account['created']
                    ? 'Resident registered. A portal account was created and emailed to them.'
                    : 'Resident registered successfully.'),
            201
        );
    }

    /**
     * Get single resident
     */
    public function show(Resident $resident): JsonResponse
    {
        // Self-heal the age bracket if the resident has had a birthday since the
        // record was last touched (Child → Youth, etc.), so the view is current.
        $resident->reconcileAgeData();

        $resident->load([
            'household',
            'sectors' => fn ($q) => $q->where('is_active', true), // hide grown-out-of brackets
            'serviceRequests', 'certificates',
            'account:id,email,resident_id,is_active,activated_at', // null when no portal account yet
            // Two generations up, one down, and sideways: `parents.parents
            // .children` is what turns the grandparents into aunts and uncles,
            // and their children into cousins.
            'parents.parents.children.children', 'parents.children', 'children', 'spouse',
            // Who is raising them, and whom they are raising. Neither is
            // derived from anything, so neither appears unless it is loaded.
            'guardians', 'wards',
        ]);

        /*
         * array_merge, NOT `+`: the union operator keeps the LEFT side on a key
         * collision, and toArray() already carries raw `parents`, `children`
         * and `spouse` from the loaded relations — so the labelled cards below
         * were being silently thrown away, and this page showed parents with
         * no Father/Mother against them while the portal showed them fine.
         */
        $payload = array_merge(
            $resident->toArray(),
            $this->derivedRelatives($resident),
            $this->careArrangements($resident),
            $this->bloodline($resident)
        );

        /*
         * `residency_status` is NOT NULL DEFAULT 'Permanent' in the schema,
         * so every non-resident silently carries it — and a default is not
         * a fact. The verification counter already refuses to repeat it;
         * this endpoint feeds the profile and the edit form, and two
         * endpoints disagreeing about the same person is how the wrong one
         * ends up on a screen nobody thought to check.
         */
        if ($resident->isNonResident()) {
            $payload['residency_status'] = null;
            $payload['zone_purok'] = null;
            $payload['length_of_residence_years'] = null;
        }

        return $this->success($payload, 'Resident retrieved successfully');
    }

    /**
     * Update resident
     */
    public function update(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $validated = $request->validate([
            'first_name' => 'string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'last_name' => 'string|max:100',
            'suffix' => 'nullable|string|max:50',
            'gender' => 'in:Male,Female,Other',
            'birthdate' => 'date',
            'civil_status' => 'nullable|string',
            /* The resident's own — see the note on store(). */
            'contact_number' => 'nullable|string',
            'email' => ['nullable', 'email', Rule::unique('residents', 'email')->ignore($resident->id)],
            'household_id' => 'nullable|exists:households,id',
            'zone_purok' => 'string',
            'residency_status' => 'in:Permanent,Temporary,Migrant',
            'length_of_residence_years' => 'nullable|integer|min:0',
            'educational_attainment' => 'nullable|string',
            'remarks' => 'nullable|string',
            'is_active' => 'boolean',
        ], [
            'email.unique' => 'This email is already registered to another resident.',
        ]);

        // Classification is the age bracket, derived from birthdate — never set
        // by hand. Other categories (PWD, Solo Parent, …) are sector tags.
        $resident->fill($validated);
        if ($resident->birthdate) {
            $resident->demographic_classification = $resident->primaryAgeClassification();
        }
        $resident->save();

        $resident->load(['household', 'sectors']);
        LandingCache::clearStats(); // is_active/purok may have changed the counts

        return $this->success($resident, 'Resident updated successfully');
    }

    /**
     * Delete resident
     */
    /**
     * Deleting a resident CASCADES into their VAWC case, KP cases, health
     * records and issued certificates — one click would erase a survivor's
     * protection history and break public certificate verification.
     *
     * So a resident who appears in any protected record cannot be deleted;
     * they are deactivated instead, which removes them from active lists and
     * counts while leaving the record trail intact. Deletion stays available
     * only for a genuinely mistaken entry that nothing references yet.
     */
    public function destroy(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $blockers = $this->protectedRecordCounts($resident);

        if (array_sum($blockers) > 0) {
            // Opt-in deactivation, so the caller cannot deactivate by accident
            // while believing they deleted.
            if ($request->boolean('deactivate')) {
                $resident->update(['is_active' => false]);
                LandingCache::clearStats();

                return $this->success($resident, 'Resident deactivated. Their records were kept.');
            }

            return $this->error(
                'This resident has records that must be kept, so they cannot be deleted. Deactivate them instead.',
                409,
                ['blockers' => array_filter($blockers)]
            );
        }

        $removed = $this->purge($resident);
        LandingCache::clearStats();

        return $this->success(
            ['removed' => $removed],
            'Resident deleted. ' . ($removed === []
                ? 'Nothing else was attached to them.'
                : 'Also removed: ' . implode(', ', $removed) . '.')
        );
    }

    /**
     * Search residents
     */
    public function search(Request $request): JsonResponse
    {
        // A blank term would otherwise fall through to an arbitrary slice of
        // the registry; the picker expects "type something to get matches".
        if (trim((string) $request->input('q')) === '') {
            return $this->success([], 'Search results');
        }

        // birthdate + purok travel with every result so two residents who
        // share a name can still be told apart at the moment of picking.
        /*
         * Which kind of record the caller wants.
         *
         * The filtering used to be done in the picker, AFTER the ten rows
         * came back — so a search for a non-resident mother named Maria
         * returned ten residents called Maria and then hid all of them. The
         * clerk saw "no matches" for somebody who was on file. A limit has
         * to be applied to the rows you actually want.
         */
        $only = $request->input('record_type');

        $residents = Resident::whereNull('merged_into_id')
            ->when($only === Resident::NON_RESIDENT, fn ($q) => $q->where('record_type', Resident::NON_RESIDENT))
            ->when($only === 'Resident', fn ($q) => $q->bonafide())
            ->nameSearch($request->input('q'))
            ->orderBy('last_name')
            ->orderBy('first_name')
            /*
             * A tie-break that never wavers.
             *
             * Two rows sharing a last and first name have no defined order
             * in SQL, so the ten that survive `limit(10)` can differ between
             * identical searches — and this register has many such pairs.
             * That alone is bad; it also made the device's own copy of the
             * search disagree with the server's, which is how a clerk stops
             * trusting both.
             */
            ->orderBy('id')
            /*
             * Twenty-five, not ten.
             *
             * Ten sounds like plenty and is not. This register holds the
             * same people several times over — one spreadsheet imported
             * four times — so a search for "james" spent all ten slots on
             * THREE people and stopped alphabetically at GANIAY. James
             * Gasang was on the register, matched the search, and could not
             * be reached: the clerk had to guess that typing more would
             * help, and from the screen there was nothing to suggest it.
             *
             * Twenty-five is still a list a person can read, and the picker
             * says when even that was not enough.
             */
            ->limit(25)
            // Non-residents ARE offered here: linking a relative who lives
            // elsewhere is the whole reason they are on the register. The
            // record type travels so the picker can mark them.
            // `life_status` travels so the picker can warn before a
            // certificate is filed for someone who has passed away.
            //
            // `contact_number` travels so a form that needs to reach the
            // person it just attached does not make a clerk copy a number
            // out of one record and into the next — which is how a digit
            // gets dropped. The row already carries a birthdate and an
            // address; a phone number sits inside the same staff-only gate.
            ->get(['id', 'resident_number', 'record_type', 'life_status', 'first_name', 'middle_name', 'last_name', 'suffix', 'birthdate', 'zone_purok', 'contact_number']);

        return $this->success($residents, 'Search results');
    }

    /**
     * Lightweight household list for the searchable picker.
     *
     * Scales to a 20k+ registry by never sending the whole table: it is a
     * typeahead — pass `?q=` to match household no. / address / purok / owner
     * name (capped), or `?ids=` to hydrate specific pre-selected households
     * (e.g. the one already on a resident being edited). With no params it
     * returns the first page so the picker isn't empty when it opens.
     */
    public function householdOptions(Request $request): JsonResponse
    {
        $query = Household::with('head:id,first_name,last_name')
            ->select(['id', 'household_number', 'zone_purok', 'street_address', 'household_head_id']);

        // Hydrate specific households by id (to display an already-chosen value).
        if ($request->filled('ids')) {
            $ids = collect(explode(',', $request->input('ids')))
                ->map(fn ($v) => (int) trim($v))
                ->filter()
                ->all();

            return $this->success($query->whereIn('id', $ids)->get(), 'Household options retrieved');
        }

        if ($request->filled('q')) {
            $search = trim($request->input('q'));
            $query->where(function ($q) use ($search) {
                $q->where('household_number', 'like', "%{$search}%")
                  ->orWhere('street_address', 'like', "%{$search}%")
                  ->orWhere('zone_purok', 'like', "%{$search}%")
                  ->orWhereHas('head', function ($hq) use ($search) {
                      $hq->where('first_name', 'like', "%{$search}%")
                         ->orWhere('last_name', 'like', "%{$search}%");
                  });
            });
        }

        $households = $query->orderBy('household_number')->limit(25)->get();

        return $this->success($households, 'Household options retrieved');
    }

    /**
     * Deletes the resident and everything that was only ever theirs.
     *
     * Most of the registry hangs off `residents` with ON DELETE CASCADE, so
     * sectors, family links, guardianships, marriages and the rest go on their
     * own. Four things did NOT: they were declared ON DELETE SET NULL, which
     * detaches a row instead of removing it, and left behind
     *
     *   - the PORTAL ACCOUNT, holding their email and password. Worse than
     *     untidy: that address still counted as taken, so re-registering the
     *     same person was refused because of an account nobody could reach.
     *   - their live-chat threads, re-labelled "Guest visitor" but still
     *     carrying whatever they had told the Secretary.
     *   - their service requests and population events, pointing at nobody.
     *
     * SET NULL is right for a REFERENCE to them — another resident's spouse
     * pointer, a merge receipt — and wrong for their own information. This is
     * the difference, written out.
     *
     * Sanctum tokens have no foreign key at all, so a live session would have
     * outlived the account it belonged to. They go first.
     *
     * Everything runs in one transaction: a half-purged resident — login gone,
     * record still standing — is worse than either outcome.
     *
     * @return string[] What was removed, in words, for the clerk.
     */
    private function purge(Resident $resident): array
    {
        $removed = [];

        DB::transaction(function () use ($resident, &$removed) {
            $account = $resident->account;

            if ($account) {
                // Any signed-in session, before the account it belongs to.
                $account->tokens()->delete();
                $email = $account->email;
                $account->delete();
                $removed[] = 'their portal account (' . $email . ')';
            }

            $chats = Conversation::where('resident_id', $resident->id)->pluck('id');

            if ($chats->isNotEmpty()) {
                DB::table('chat_messages')->whereIn('chat_conversation_id', $chats)->delete();
                Conversation::whereIn('id', $chats)->delete();
                $removed[] = $chats->count() . ' chat conversation(s)';
            }

            $requests = DB::table('service_requests')->where('resident_id', $resident->id)->count();

            if ($requests > 0) {
                DB::table('service_requests')->where('resident_id', $resident->id)->delete();
                $removed[] = $requests . ' service request(s)';
            }

            $events = DB::table('population_events')->where('resident_id', $resident->id)->count();

            if ($events > 0) {
                DB::table('population_events')->where('resident_id', $resident->id)->delete();
                $removed[] = $events . ' population event(s)';
            }

            // And the record itself. The cascades take the rest with it.
            /*
             * A house cannot be headed by somebody who no longer exists.
             *
             * households.household_head_id has NO foreign key on it, so the
             * database will not clear it and nothing complains: the row goes
             * on naming a resident id that is not there. Two households in
             * this register are still headed by resident #1, deleted weeks
             * ago — the household list shows a blank owner and no page says
             * why.
             *
             * Cleared, not reassigned. Who takes over a household is a
             * decision for the office, not something to infer from whoever
             * happens to live at the address.
             */
            $headed = Household::where('household_head_id', $resident->id)->get();

            foreach ($headed as $house) {
                // Recorded before the resident row goes: once it is deleted
                // there is nothing left to name as the previous owner, and
                // the house would simply appear to have never had one.
                $house->handOverTo(null, 'Owner moved out', 'The owner\'s record was deleted.');
            }

            if ($headed->isNotEmpty()) {
                $removed[] = $headed->count() . ' household(s) left without an owner '
                    . '(set one from the household record)';
            }

            $resident->delete();
        });

        return $removed;
    }

    /** Records whose loss would be unacceptable, keyed for the UI to explain. */
    private function protectedRecordCounts(Resident $resident): array
    {
        return [
            'VAWC cases' => $resident->vawcCases()->count(),
            'KP cases (as complainant)' => $resident->luponCases()->count(),
            'KP cases (as respondent)' => \App\Models\Lupon\CaseFile::whereHas(
                'respondents',
                fn ($q) => $q->where('residents.id', $resident->id)
            )->count(),
            'Certificates issued' => $resident->certificates()->count(),
            'Health visits' => $resident->healthVisits()->count(),
        ];
    }
}
