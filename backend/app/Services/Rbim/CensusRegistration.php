<?php

namespace App\Services\Rbim;

use App\Models\Household\Household;
use App\Models\Rbim\Census;
use App\Models\Rbim\CensusMember;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Services\Content\LandingCache;
use App\Services\Account\PortalAccount;
use Illuminate\Support\Facades\DB;

/**
 * Registers the household — the one door from a census to the register.
 *
 * Every line with a name becomes a resident record, and the line is
 * joined to it so the two can never drift into being two people. Lines
 * already joined are left alone, which is what makes this safe to press
 * again after an edit: a household that gains a baby is submitted again
 * and only the baby is new.
 *
 * Nothing is written unless EVERY line can be. A household half on the
 * register is worse than one not on it at all — nobody can tell by
 * looking which half, and the second attempt would duplicate the first.
 * So the whole sheet is checked first and refused as a whole, naming the
 * line and the box, and it all happens in one transaction.
 */
final class CensusRegistration
{
    /**
     * @return array{0: Census, 1: string} the census, and what to tell the office
     *
     * @throws CensusSubmissionRefused
     */
    public function register(Census $census): array
    {
        $members = $census->members()->orderBy('id')->get();

        if ($members->isEmpty()) {
            throw new CensusSubmissionRefused('Add at least one household member before submitting.', 422);
        }

        /*
         * Consent is not paperwork. The form carries a signature block and
         * says the answers may not be used without it — so a census with no
         * consent recorded does not become a household on the register.
         */
        if (!$census->consent_given) {
            throw new CensusSubmissionRefused(
                'The respondent\'s consent has not been recorded. The household cannot be '
                    . 'registered without it.',
                422
            );
        }

        if (!$census->zone_purok) {
            throw new CensusSubmissionRefused(
                'Set the purok on the form. Every resident record carries one, and the '
                    . 'paper sheet has nowhere to record it.',
                422
            );
        }

        // Only lines somebody has actually filled in. A blank card is not a
        // person, and a form of ten always has some.
        $named = $members->filter(fn ($m) => trim((string) $m->first_name) !== ''
            || trim((string) $m->last_name) !== '');

        /*
         * And only the lines marked for it.
         *
         * Line 1 is the household head and is always registered — there is no
         * household without one, which is why that line has no switch. The
         * rest default to on and can be turned off: a census records who was
         * in the house that evening, and a visiting cousin from the next
         * barangay belongs on the sheet without belonging on this register.
         */
        $first = $named->first();

        $toRegister = $named->filter(
            fn ($m) => $m->id === $first?->id || $m->register_as_resident
        );

        if ($named->isEmpty()) {
            throw new CensusSubmissionRefused('No line on this form has a name on it.', 422);
        }

        $problems = [];

        foreach ($named as $member) {
            $line = $members->search(fn ($m) => $m->id === $member->id) + 1;

            if ($member->resident_id) {
                continue; // already on the register; nothing to check
            }

            $missing = [];

            if (trim((string) $member->first_name) === '') { $missing[] = 'a first name (Q1)'; }
            if (trim((string) $member->last_name) === '') { $missing[] = 'a surname (Q1)'; }
            if (!in_array((int) $member->q3_sex, [1, 2], true)) { $missing[] = 'sex (Q3)'; }

            if (!$this->birthdateOf($member)) {
                $missing[] = 'a birth month and year (Q5)';
            }

            if ($missing !== []) {
                $problems[] = 'Line ' . $line . ' (' . trim($member->first_name . ' ' . $member->last_name)
                    . ') needs ' . implode(', ', $missing) . '.';
            }
        }

        if ($problems !== []) {
            throw new CensusSubmissionRefused(
                'The register needs a little more than the paper form asks. '
                    . implode(' ', $problems),
                422,
                ['members' => $problems]
            );
        }

        $registered = [];
        $already = 0;
        $family = [];
        /* Names of people the census filled a gap for. */
        $toppedUp = [];
        /*
         * Held for after the commit. Issuing the accounts inside the
         * transaction would send welcome emails for residents a rollback
         * then un-creates, and an email cannot be recalled.
         */
        $newResidents = [];

        DB::transaction(function () use ($census, $named, $toRegister, &$first, &$registered, &$already, &$family, &$newResidents, &$toppedUp) {
            /*
             * The household first, so every person created below can be put
             * in it. The census number IS the household number — one number,
             * one house — so an existing household is reused rather than
             * doubled.
             */
            $household = $census->household_id
                ? Household::find($census->household_id)
                : Household::firstOrCreate(
                    ['household_number' => $census->census_no],
                    [
                        'zone_purok' => $census->zone_purok,
                        'street_address' => trim(implode(', ', array_filter([
                            $census->address_unit,
                            $census->address_house_lot,
                            $census->address_street,
                        ]))) ?: null,
                    ]
                );

            foreach ($toRegister as $member) {
                if ($member->resident_id) {
                    $already++;

                    /*
                     * Already on the register is not the same as nothing to
                     * do. This branch used to `continue` and drop everything
                     * the interview had just established.
                     *
                     * Q35 is the one that showed it up: a household was
                     * interviewed, somebody answered "twenty years and eleven
                     * months at this address", the line was matched to a
                     * resident who was registered half an hour earlier — and
                     * the answer went nowhere. The Certificate of Residency
                     * then printed "resides at the said place for ______
                     * years" with the blank still in it, because the register
                     * had never been told.
                     */
                    $toppedUp = array_merge(
                        $toppedUp,
                        $this->topUpFromCensus($member, $census, $household),
                    );

                    continue;
                }

                $resident = $this->registerLine($member, $census, $household);
                $member->update(['resident_id' => $resident->id]);
                $registered[] = $resident->full_name;
                $newResidents[] = $resident;
            }

            /*
             * Line 1 is the head — that is what Q2 code 01 means — so the
             * household is headed by whoever line 1 turned out to be.
             */
            $first = $first?->fresh();

            if ($household && $first?->resident_id && !$household->household_head_id) {
                $household->update(['household_head_id' => $first->resident_id]);
            }

            /*
             * Q2 said who these people are to each other. Now that they all
             * exist, that column of codes becomes a family — read fresh,
             * because the lines were only just given their resident ids.
             */
            $family = $this->buildFamilyFrom(
                $census->members()->orderBy('id')->get()->filter(
                    fn ($m) => trim((string) $m->first_name) !== ''
                        || trim((string) $m->last_name) !== ''
                )
            );

            $census->update([
                'household_id' => $household?->id,
                'status' => 'Submitted',
                'submitted_at' => now(),
            ]);
        });

        /*
         * The portal accounts, issued here rather than asked for.
         *
         * Registering somebody and then going to their profile to press
         * "Issue a portal account" was the same intent typed twice, and the
         * second press is the one that gets forgotten — which is how a
         * barangay ends up with a register full of residents and a portal
         * nobody can sign in to. Registration IS the moment the account is
         * warranted, so this is where it happens.
         *
         * provision() never throws and refuses on its own terms: no email on
         * the line, a non-resident, an address already in use. Each refusal
         * is a sentence the office can act on, so they are reported rather
         * than swallowed — and none of them undoes the registration, which
         * is the record that actually matters.
         */
        $accounts = [];
        $withoutAccount = [];

        foreach ($newResidents as $resident) {
            $account = PortalAccount::provision($resident, auth()->id());

            if ($account['created']) {
                $accounts[] = $resident->full_name;
            } elseif ($resident->email) {
                /*
                 * Only worth a sentence if they GAVE an email. A census line
                 * with no email address is the ordinary case — most of this
                 * barangay has no mailbox — and naming every one of them
                 * would bury the two that genuinely went wrong.
                 */
                $withoutAccount[] = $resident->full_name . ' — ' . lcfirst($account['reason']);
            }
        }

        LandingCache::clearStats();

        $count = count($registered);

        return [
            $census->fresh()->load('members.resident'),
            $count === 0
                ? 'Submitted. Everybody on this form was already on the register.'
                    . ($toppedUp !== []
                        ? ' The census filled in details the register was missing for '
                            . implode('; ', $toppedUp) . '.'
                        : '')
                : $count . ' ' . ($count === 1 ? 'person is' : 'people are')
                    . ' now on the barangay register: ' . implode(', ', $registered) . '.'
                    . ($already > 0 ? ' ' . $already . ' were already there.' : '')
                    /*
                     * Said out loud, because a record changing quietly is a
                     * record nobody checks. The office should see that the
                     * interview filled something in.
                     */
                    . ($toppedUp !== []
                        ? ' The census filled in details the register was missing for '
                            . implode('; ', $toppedUp) . '.'
                        : '')
                    // What Q2 turned into family, so the office sees it happened.
                    . ($family !== [] ? ' ' . implode(' ', $family) : '')
                    /*
                     * Counted, not listed. The names are already in the
                     * sentence above; repeating them to say each also got a
                     * login is noise.
                     */
                    . (count($accounts) > 0
                        ? ' ' . count($accounts) . ' portal '
                            . (count($accounts) === 1 ? 'account was' : 'accounts were')
                            . ' issued — they activate with the code we emailed them.'
                        : '')
                    . ($withoutAccount !== []
                        ? ' No portal account for ' . implode('; ', $withoutAccount)
                        : '')
        ];
    }

    /**
     * The date of birth the register will hold, from Q5 alone.
     *
     * The census asks for a month and a year. It does not ask for a day and
     * should not: the BHW is copying a sheet that has no box for one, so any
     * day recorded here would be invented.
     *
     * The last day of the month, then — which makes age turn over at the end
     * of the birth month. Somebody born in June is 32 for all of June and 33
     * from July. That is the safe direction to be wrong in: it never makes
     * anybody older than they are, so nobody is handed a senior citizen's
     * entitlement or a youth programme's cut-off a month early.
     *
     * Whoever ends up holding this record is told it is approximate — see
     * `birthdate_is_estimated`.
     */
    private function birthdateOf(CensusMember $member): ?string
    {
        $year = (int) $member->q5_birth_year;
        $month = (int) $member->q5_birth_month;

        if ($year < 1900 || $month < 1 || $month > 12) {
            return null;
        }

        // cal_days_in_month is not always compiled in; this is the same sum.
        $lastDay = (int) date('t', mktime(0, 0, 0, $month, 1, $year));

        return sprintf('%04d-%02d-%02d', $year, $month, $lastDay);
    }

    /**
     * Carries what the census answered onto a resident already registered.
     *
     * GAPS ONLY. A value a clerk typed at the counter is never overwritten by
     * one from an interview, and that is the whole rule — not caution, but
     * whose answer is more likely to be right. The counter saw a birth
     * certificate; the census asked somebody at the door, sometimes about a
     * relative who was out. So the census fills what is blank and argues with
     * nothing.
     *
     * The one it exists for is Q35: how long they have lived here. The
     * register has a column for it, the census is the only place anybody is
     * ever asked, and the Certificate of Residency prints it.
     *
     * @return string[] the names of the fields filled, for the reply
     */
    private function topUpFromCensus(
        CensusMember $member,
        Census $census,
        ?Household $household
    ): array {
        $resident = Resident::find($member->resident_id);

        if (! $resident) {
            return [];
        }

        $marital = CensusMember::MARITAL_STATUSES[(int) $member->q8_marital_status] ?? null;

        /* field => [what the census says, how to describe it] */
        $candidates = [
            'length_of_residence_years' => [
                $member->q35_stay_years !== null ? (int) $member->q35_stay_years : null,
                'length of residence',
            ],
            'birth_place' => [$member->q6_birthplace ?: null, 'birthplace'],
            'civil_status' => [
                in_array($marital, ['Single', 'Married', 'Widowed', 'Separated'], true) ? $marital : null,
                'civil status',
            ],
            'contact_number' => [$member->contact_number ?: null, 'contact number'],
            'birthdate' => [$this->birthdateOf($member), 'birthdate'],
            'zone_purok' => [$census->zone_purok ?: null, 'purok'],
            'household_id' => [$household?->id, 'household'],
        ];

        $changes = [];
        $filled = [];

        foreach ($candidates as $field => [$value, $label]) {
            /* Blank on the register, answered on the census. Both, or neither. */
            if ($value === null || $value === '') {
                continue;
            }

            $current = $resident->getAttribute($field);

            if ($current !== null && $current !== '') {
                continue;
            }

            $changes[$field] = $value;
            $filled[] = $label;
        }

        /*
         * The email is held back from the loop because residents.email is
         * unique: writing one another record already holds is not a gap being
         * filled, it is a 500 at the counter.
         */
        if (
            ! $resident->email
            && $member->email
            && ! Resident::where('email', $member->email)->whereKeyNot($resident->id)->exists()
        ) {
            $changes['email'] = $member->email;
            $filled[] = 'email address';
        }

        if ($changes === []) {
            return [];
        }

        $resident->update($changes);

        /*
         * A birthdate that came from Q5 is a month and a year with the day
         * invented, and the record has to say so — the same flag registerLine
         * sets, for the same reason.
         */
        if (array_key_exists('birthdate', $changes)) {
            $resident->update(['birthdate_is_estimated' => true]);
        }

        return [$resident->full_name . ' (' . implode(', ', $filled) . ')'];
    }

    /**
     * Turns one census line into a resident record.
     *
     * Only what the census actually answers is carried. Q11's education codes
     * and the register's list are different vocabularies, and Q36's type of
     * resident is worked out from Q33–Q35 rather than asked — so neither is
     * guessed at here. A blank field is honest; a wrong one is not.
     */
    private function registerLine(
        CensusMember $member,
        Census $census,
        ?Household $household
    ): Resident {
        // Only the four the register offers. Living-in, Divorced and Unknown
        // have no equivalent there, and a wrong civil status is worse than none.
        $marital = CensusMember::MARITAL_STATUSES[(int) $member->q8_marital_status] ?? null;
        $civil = in_array($marital, ['Single', 'Married', 'Widowed', 'Separated'], true)
            ? $marital
            : null;

        $resident = Resident::create([
            // The register's own rule, not a second copy of it.
            'resident_number' => Resident::nextNumber(),
            'first_name' => trim($member->first_name),
            'middle_name' => trim((string) $member->middle_name) ?: null,
            'last_name' => trim($member->last_name),
            'gender' => CensusMember::SEXES[(int) $member->q3_sex] ?? null,
            'birthdate' => $this->birthdateOf($member),
            /*
             * A month's worth of approximation, and the record says so. A
             * clerk about to put this on a certificate needs to know it came
             * from a census and not a birth certificate.
             */
            'birthdate_is_estimated' => true,
            'birth_place' => $member->q6_birthplace ?: null,
            'civil_status' => $civil,
            'email' => $member->email ?: null,
            'contact_number' => $member->contact_number ?: null,
            'household_id' => $household?->id,
            'zone_purok' => $census->zone_purok,
            // Everybody on a household census sheet lives there. Q36 asks
            // something else entirely, and is not this question.
            'residency_status' => 'Permanent',
            /*
             * Q35 already asked how long they have lived here, and the
             * register has a column for it — they were simply never joined
             * up. A certificate of indigency often has to state it, and an
             * office that has the answer on the census sheet should not be
             * asking the household for it a second time at the counter.
             *
             * Whole years. The months in Q35 are not dropped — they are on
             * the census line, which is where the finer answer lives.
             */
            'length_of_residence_years' => $member->q35_stay_years !== null
                ? (int) $member->q35_stay_years
                : null,
            'address' => trim(implode(', ', array_filter([
                $census->address_unit,
                $census->address_house_lot,
                $census->address_street,
            ]))) ?: null,
        ]);

        /*
         * The age-derived tags, from the register's own rule rather than a
         * second copy of it here — this is what puts a new senior citizen on
         * the sector list the day they are registered.
         */
        $resident->demographic_classification = $resident->primaryAgeClassification();
        $resident->save();

        foreach ($resident->ageSectors() as $sector) {
            $resident->sectors()->create([
                'sector_type' => $sector,
                'enrolled_date' => now()->toDateString(),
            ]);
        }

        return $resident;
    }

    /**
     * Turns Q2 into the family links the register keeps.
     *
     * Without this, a household registered from a census is a list of people
     * who happen to share an address — which is all the register would know
     * about a married couple and their children. Every person now arrives
     * this way, so Q2 is the only thing that ever says otherwise.
     *
     * Only the codes that say something unambiguous:
     *
     *   02 Spouse         married to the head.
     *   03 Son            a child of the head, and of the head's spouse
     *   04 Daughter       where there is one.
     *
     * Everything else is left alone, deliberately. A grandson (09) is the
     * child of one of the head's children, and the sheet does not say which;
     * an in-law belongs to a marriage the sheet does not record; a boarder is
     * not family at all. Guessing at those would put relationships in the
     * register that nobody stated.
     *
     * Stepson and stepdaughter (05, 06) are recorded on the line and linked
     * to nobody: the register does not model step relationships, and their
     * own two parents belong on their record instead.
     *
     * Safe to run again. A form re-submitted after an edit finds the links
     * already there and adds nothing.
     *
     * @return string[] what it did, for the office to read
     */
    private function buildFamilyFrom($lines): array
    {
        $notes = [];

        $residentOf = fn ($line) => $line?->resident_id ? Resident::find($line->resident_id) : null;

        $head = $residentOf($lines->first());

        if (!$head) {
            return $notes;
        }

        $spouseLine = $lines->first(fn ($m) => (int) $m->q2_relationship === 2);
        $spouse = $residentOf($spouseLine);

        if ($spouse && $spouse->id !== $head->id && $head->spouse_id !== $spouse->id) {
            /*
             * Q2 says WHO; Q8 says what kind of union. A couple who both
             * answered Living-in are recorded as partners rather than
             * married — that is true of them, and it is the answer that
             * their own civil status already carries.
             */
            $liveIn = (int) $lines->first()->q8_marital_status === 3
                && (int) $spouseLine->q8_marital_status === 3;

            $head->marryTo($spouse, null, $liveIn ? Marriage::LIVE_IN : 'Married');

            $notes[] = $spouse->full_name . ' is recorded as the '
                . ($liveIn ? 'partner' : 'spouse') . ' of ' . $head->full_name . '.';
        }

        $children = $lines->filter(fn ($m) => in_array((int) $m->q2_relationship, [3, 4], true));
        $linked = [];

        foreach ($children as $line) {
            $child = $residentOf($line);

            if (!$child || $child->id === $head->id) {
                continue;
            }

            $childRole = Resident::roleLabel($child->gender, 'child');

            $head->children()->syncWithoutDetaching([$child->id => [
                'parent_role' => Resident::roleLabel($head->gender, 'parent'),
                'child_role' => $childRole,
            ]]);

            /*
             * And the head's spouse, because a census line that says "Son"
             * says son OF THE HOUSEHOLD, and a child with one parent on file
             * is a child the other parent's record does not know about.
             */
            if ($spouse && $spouse->id !== $child->id) {
                $spouse->children()->syncWithoutDetaching([$child->id => [
                    'parent_role' => Resident::roleLabel($spouse->gender, 'parent'),
                    'child_role' => $childRole,
                ]]);
            }

            $linked[] = $child->full_name;
        }

        if ($linked !== []) {
            $notes[] = count($linked) . ' ' . (count($linked) === 1 ? 'child is' : 'children are')
                . ' linked to ' . ($spouse ? 'both parents' : $head->full_name) . '.';
        }

        return $notes;
    }
}
