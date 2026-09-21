<?php

namespace App\Http\Controllers\Api\Resident\Concerns;

use App\Models\Resident\Resident;
use App\Services\Content\LandingCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Putting a person on the register: the rules a record is held to, the
 * namesake check, and the portal account that comes with a new record.
 */
trait RegistersResidents
{
    /**
     * Every field a resident record holds. Shared by registration and by the
     * Add parent / Add child / Add spouse forms, so a family member is
     * captured to exactly the same standard as anyone else in the registry
     * rather than as a bare name on someone else's record.
     */
    private function residentRules(): array
    {
        return [
            'first_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            /*
             * The one field that separates two people who share a name AND a
             * birthday — no amount of cleverer matching can, once those
             * agree. It is on the PSA birth certificate, and in Philippine
             * naming it IS the middle name, so it also recovers the middle
             * name for a record that has none.
             */
            'mother_maiden_name' => 'nullable|string|max:100',
            'last_name' => 'required|string|max:100',
            'suffix' => 'nullable|string|max:50',
            'gender' => 'required|in:Male,Female',
            'birthdate' => 'required|date',
            'birth_place' => 'nullable|string|max:150',
            'civil_status' => 'nullable|string',
            /*
             * Not here. A resident sets their own occupation from the portal;
             * an office typing a neighbour's is a guess, and the guess is
             * what a livelihood programme gets planned around.
             */
            'contact_number' => 'nullable|string',
            // Email is optional, but must be unique because it becomes the
            // resident's portal login the moment the record is created.
            'email' => 'nullable|email|unique:residents,email',
            'household_id' => 'nullable|exists:households,id',
            'zone_purok' => 'required|string',
            'residency_status' => 'required|in:Permanent,Temporary,Migrant',
            'length_of_residence_years' => 'nullable|integer',
            'educational_attainment' => 'nullable|string',
            'demographic_classification' => 'nullable|in:Senior Citizen,PWD,Solo Parent,Youth,Child,Adult,Others',
            // Sector tags chosen on the form (age-based + manual toggles).
            'sectors' => 'nullable|array',
            'sectors.*' => 'string|max:100',
        ];
    }

    /**
     * The little that is asked of someone who does NOT live in the barangay.
     *
     * A resident's mother two towns over still has to exist so the family can
     * be recorded, but asking her for a purok, a residency status or a length
     * of residence is asking for something that does not exist. A name, a
     * number and an address is all the barangay needs to reach her.
     */
    private function nonResidentRules(): array
    {
        return [
            'first_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'last_name' => 'required|string|max:100',
            'suffix' => 'nullable|string|max:50',
            // Optional, but it is what turns "Parent" into "Mother" on the
            // child's record — every family word is derived from it.
            'gender' => 'nullable|in:Male,Female',
            'contact_number' => 'nullable|string',
            'address' => 'nullable|string|max:255',
        ];
    }

    /**
     * Namesakes are ordinary in a barangay: two people really can be "Juan
     * Dela Cruz". So an existing match is a confirmation step, not a block —
     * the clerk is shown who already holds the name (with birthdate and purok
     * to tell them apart) and decides whether this is the same person or a
     * genuinely different one. Returns a 409 to send back, or null to proceed.
     */
    private function namesakeCheck(Request $request, array $validated): ?JsonResponse
    {
        if ($request->boolean('confirm_namesake')) {
            return null;
        }

        $namesakes = $this->possibleDuplicates($validated);

        if ($namesakes->isEmpty()) {
            return null;
        }

        // Everything matched is a different person → say so plainly and let
        // the clerk carry on, rather than crying duplicate at a real namesake.
        if ($namesakes->every(fn ($r) => $r->confidence === 'different_person')) {
            return $this->error(
                'Someone with this name is already registered, but with a different mother — so this is a different person. Confirm to continue.',
                409,
                ['namesakes' => $namesakes]
            );
        }

        /*
         * The headline states the STRONGEST thing the evidence supports, so a
         * clerk skimming it is not misled either way: a confirmed match must
         * not read as a maybe, and a maybe must not read as a certainty.
         */
        $message = match (true) {
            $namesakes->contains(fn ($r) => $r->confidence === 'confirmed')
                => 'Someone with this name, birthday AND mother\'s maiden name is already registered — this is the same person.',
            $namesakes->contains(fn ($r) => $r->confidence === 'unknown')
                => 'Someone with this exact name AND birthday is already registered. Record the mother\'s maiden name on both to tell them apart.',
            $namesakes->contains(fn ($r) => $r->match_reason === 'birthdate')
                => 'Someone with this surname and the SAME BIRTHDAY is already registered — very likely the same person.',
            default => 'A resident with this name is already registered.',
        };

        return $this->error($message, 409, ['namesakes' => $namesakes]);
    }

    /**
     * Records that might already BE this person.
     *
     * Matching on the full name alone was letting the commonest duplicate of
     * all straight through: the same person written down under a nickname —
     * "James" one year, "Jims" the next — who then ends up with their
     * certificates on one record and their family on the other. A shared
     * surname AND a shared birthdate is a far stronger signal than spelling,
     * so it counts as a match in its own right.
     *
     * @param  array<string,mixed>  $data
     */
    private function possibleDuplicates(array $data, ?int $excludeId = null)
    {
        $first = $data['first_name'] ?? null;
        $last = $data['last_name'] ?? null;
        $birthdate = $data['birthdate'] ?? null;

        return Resident::whereNull('merged_into_id')
            ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
            ->where(function ($q) use ($first, $last, $birthdate) {
                $q->where(fn ($w) => $w->where('first_name', $first)->where('last_name', $last));

                if ($last && $birthdate) {
                    $q->orWhere(fn ($w) => $w->where('last_name', $last)->whereDate('birthdate', $birthdate));
                }
            })
            ->orderBy('birthdate')
            ->get(['id', 'resident_number', 'first_name', 'middle_name', 'mother_maiden_name',
                'last_name', 'suffix', 'birthdate', 'birth_place', 'zone_purok', 'household_id',
                'is_active', 'email'])
            ->each(fn ($candidate) => $this->gradeCandidate($candidate, $data))
            ->values();
    }

    /**
     * How sure we are that a candidate is the same person, and why.
     *
     * The name and the birthday get you as far as "maybe" and no further:
     * once both agree, the record holds nothing else to go on, and two
     * unrelated people sharing them is uncommon but real. The MOTHER'S MAIDEN
     * NAME is what resolves it — so it decides the verdict outright when both
     * records have it, and when they do not, the honest answer is that we
     * cannot tell and somebody has to go and find out.
     */
    private function gradeCandidate($candidate, array $data): void
    {
        $norm = fn (?string $v) => $v === null || trim($v) === ''
            ? null
            : preg_replace('/[^a-z]/', '', mb_strtolower($v));

        $sameFirst = $norm($candidate->first_name) === $norm($data['first_name'] ?? null);
        $sameBirthday = !empty($data['birthdate'])
            && $candidate->birthdate
            && $candidate->birthdate->toDateString()
                === \Illuminate\Support\Carbon::parse($data['birthdate'])->toDateString();

        $candidate->match_reason = $sameFirst && $sameBirthday
            ? 'both'
            : ($sameBirthday ? 'birthdate' : 'name');

        $mineMother = $norm($data['mother_maiden_name'] ?? null);
        $theirMother = $norm($candidate->mother_maiden_name);

        if ($mineMother !== null && $theirMother !== null) {
            if ($mineMother === $theirMother) {
                $candidate->confidence = 'confirmed';
                $candidate->verdict = "Same mother's maiden name — the same person.";
            } else {
                $candidate->confidence = 'different_person';
                $candidate->verdict = 'Different mother (' . $candidate->mother_maiden_name
                    . ') — two different people who happen to share a name.';
            }

            return;
        }

        if ($sameFirst && $sameBirthday) {
            // The genuinely undecidable case, and the only honest response is
            // to name the missing evidence rather than guess at it.
            $candidate->confidence = 'unknown';
            $candidate->verdict = 'Same name and the same birthday, but no mother\'s maiden name on '
                . ($theirMother === null ? 'that record' : 'this one')
                . '. Record it on both — it is on the PSA birth certificate — and the answer is decided.';

            return;
        }

        $candidate->confidence = 'likely';
        $candidate->verdict = $sameBirthday
            ? 'Same surname and birthday, different spelling of the first name — usually a nickname for the same person.'
            : 'Same name, different birthday — usually two different people.';
    }

    /** Writes the registry record and its sector tags. */
    private function createResident(array $validated): Resident
    {
        $sectors = collect($validated['sectors'] ?? [])->filter()->unique()->values();
        unset($validated['sectors'], $validated['confirm_namesake']);

        // Generate the record number, prefixed NR- for somebody who lives
        // elsewhere so the two kinds are told apart on sight.
        $validated['resident_number'] = $this->generateResidentNumber(
            ($validated['record_type'] ?? null) === Resident::NON_RESIDENT
        );

        $resident = Resident::create($validated);

        foreach ($sectors as $sectorType) {
            $resident->sectors()->create([
                'sector_type' => $sectorType,
                'enrolled_date' => now()->toDateString(),
            ]);
        }

        LandingCache::clearStats(); // refresh the public "at a glance" count
        $resident->load('sectors');

        return $resident;
    }

    /**
     * Attaches what happened to the portal account to the resident payload,
     * so the clerk learns immediately that (say) no email was on file and no
     * login could be issued, instead of discovering it weeks later.
     */
    private function withAccountNotice(Resident $resident, array $account): array
    {
        return $resident->toArray() + [
            'portal_account' => [
                'created' => $account['created'],
                'email' => $account['user']?->email,
                // Shown once so the clerk can tell the resident at the counter;
                // it is the standard Lastname + MMDDYY default either way.
                'password' => $account['password'],
                'reason' => $account['reason'],
            ],
        ];
    }

    /**
     * Generate unique resident number
     */
    /**
     * The number on the record, and what it says at a glance.
     *
     * A non-resident is prefixed NR-. Both kinds live in one table and
     * appear in the same pickers and search results, and a clerk reading
     * "2026-000034" has no way to tell whether the person in front of them
     * is a constituent. NR-2026-0001 says it without being looked up.
     *
     * Residents keep the bare year-sequence they have always had. Their
     * numbers are printed on certificates already in people's hands and
     * quoted in the public verification page; renumbering them would
     * invalidate paper the barangay has issued.
     *
     * The two sequences are counted separately, so neither leaves gaps in
     * the other.
     */
    /**
     * The register's numbering lives on the model, because a census can also
     * put somebody on the register and the two have to issue the same shape
     * of number. The DEMO PLACEHOLDER parked at 2026-999999 is skipped there,
     * as any all-nines value is.
     */
    private function generateResidentNumber(bool $nonResident = false): string
    {
        return Resident::nextNumber($nonResident);
    }
}
