<?php

namespace App\Http\Controllers\Api\Rbim;

use App\Http\Controllers\Api\BaseController;
use App\Models\Household\Household;
use App\Models\Rbim\Census;
use App\Models\Rbim\CensusMember;
use App\Models\Resident\Resident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The questions the form asks the server while it is being typed. */
class LookupController extends BaseController
{
    /** Every code list on the form, so the frontend renders one source. */
    public function codeLists(): JsonResponse
    {
        return $this->success([
            'member' => CensusMember::codeLists(),
            'household' => Census::codeLists(),
        ], 'RBIM code lists retrieved');
    }

    /**
     * Is this email address free to be a login?
     *
     * `residents.email` is unique because a portal account is issued against
     * an address and against nothing else. Two people cannot share one, and
     * the place to find that out is the doorstep — while the BHW is still
     * standing there and can ask for another one — not three weeks later
     * when a line is being matched and the address is silently dropped.
     *
     * The phone number is not checked. A household shares a phone all the
     * time, nothing is issued against it, and warning about it would teach
     * the office to click past warnings.
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $email = trim((string) $request->input('email'));

        if ($email === '') {
            return $this->error('Type an email address to check.', 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->success([
                'email' => $email,
                'available' => false,
                'reason' => 'malformed',
            ], 'That does not look like an email address.');
        }

        /*
         * The register first — this is the one that actually blocks a login.
         *
         * A hit is not automatically a mistake. The commonest case by far is
         * that this IS the person: a head already on the register, being
         * written onto a census form. So the answer names who holds it and
         * lets the office decide, rather than calling it an error.
         */
        $resident = Resident::where('email', $email)
            ->whereNull('merged_into_id')
            ->first(['id', 'resident_number', 'first_name', 'middle_name', 'last_name']);

        if ($resident) {
            /*
             * Their own address is not a clash.
             *
             * A line already matched to this resident, carrying the address
             * the register holds for them, is the system working. Calling
             * that a duplicate would put a red warning on every correctly
             * matched line in the form and teach the office to ignore it.
             */
            if ((int) $request->input('resident_id') === $resident->id) {
                return $this->success([
                    'email' => $email,
                    'available' => true,
                    'reason' => 'own',
                ], 'This is their own address, already on the register.');
            }

            return $this->success([
                'email' => $email,
                'available' => false,
                'reason' => 'resident',
            ], 'This email is already in use by another resident.');
        }

        /*
         * Then the other census forms. This blocks nothing yet — neither
         * line has reached the register — but two forms holding one address
         * means one of them is wrong, and it is cheaper to find out now.
         *
         * The form being typed is excluded: its own lines are checked on
         * screen, where the answer needs no round trip.
         */
        $onCensus = CensusMember::query()
            ->where('email', $email)
            ->when($request->filled('census_id'),
                fn ($q) => $q->where('rbim_census_id', '!=', (int) $request->input('census_id')))
            ->exists();

        if ($onCensus) {
            return $this->success([
                'email' => $email,
                'available' => false,
                'reason' => 'census',
            ], 'This email is already in use on another census form.');
        }

        return $this->success([
            'email' => $email,
            'available' => true,
        ], 'Free to use — a portal account can be issued to it.');
    }

    /**
     * Is this household number already on the register, and who is in it?
     *
     * The paper form holds ten lines. A household with fifteen people needs
     * two sheets, and the second one is NOT a second household — it is the
     * same house, continued. Without this check the office types the number
     * again, gets a new record, and one family ends up on the books twice
     * with nothing linking the halves.
     *
     * It answers, and does nothing else. Whether to join the existing house
     * or to correct a mistyped number is the clerk's call — and sometimes
     * neither, because the respondent gave the wrong number and somebody has
     * to go back and ask.
     */
    public function verifyHousehold(Request $request): JsonResponse
    {
        $number = trim((string) $request->input('household_number'));

        if ($number === '') {
            return $this->error('Type a household number to check.', 422);
        }

        /*
         * The form first.
         *
         * One number, one household, one census form — so if a form already
         * carries this number, that IS the record for this house and the
         * office should be standing in it, adding the people the second
         * sheet lists. Starting a new form would split one family across
         * two records that nothing joins.
         */
        /*
         * Except the form being edited.
         *
         * Verifying the number that is already on this form used to report
         * the form itself as a clash, and offer a "Continue editing" link
         * pointing at the page the office was already looking at. Clicking it
         * did nothing, which read as the form refusing to be edited.
         */
        $census = Census::where('census_no', $number)
            ->when($request->filled('census_id'),
                fn ($q) => $q->where('id', '!=', (int) $request->input('census_id')))
            ->withCount('members')
            ->first();

        $household = Household::where('household_number', $number)
            ->with(['head:id,resident_number,first_name,last_name'])
            ->first();

        if (!$census && !$household) {
            return $this->success([
                'exists' => false,
                'household_number' => $number,
            ], 'Nothing carries that number yet — this will be a new one.');
        }

        if ($census) {
            return $this->success([
                'exists' => true,
                'census' => $census->only([
                    'id', 'census_no', 'status', 'household_head_name', 'members_count',
                ]),
                'household' => $household?->only([
                    'id', 'household_number', 'zone_purok', 'street_address',
                ]),
                'residents' => $household
                    ? Resident::where('household_id', $household->id)
                        ->whereNull('merged_into_id')
                        ->orderBy('last_name')
                        // Sex and birthdate travel too: the form starts from who the
                        // register already says lives here, and Q3 and Q4 are
                        // answers it already holds.
                        ->get(['id', 'resident_number', 'first_name', 'middle_name',
                               'last_name', 'gender', 'birthdate', 'birthdate_is_estimated'])
                    : [],
                'resident_count' => $household
                    ? Resident::where('household_id', $household->id)->whereNull('merged_into_id')->count()
                    : 0,
            ], 'Census ' . $census->census_no . ' already covers this household — '
                . $census->members_count . ' line(s) are on it. Open it and add the rest there.');
        }

        /*
         * Who is already there, and which census forms already cover it.
         * Both matter: the first says how many lines the next sheet is
         * continuing from, the second says whether somebody has already
         * typed this visit in.
         */
        $residents = Resident::where('household_id', $household->id)
            ->whereNull('merged_into_id')
            ->orderBy('last_name')
            ->get(['id', 'resident_number', 'first_name', 'middle_name', 'last_name',
                    'record_type', 'gender', 'birthdate', 'birthdate_is_estimated']);

        $censuses = Census::where('household_id', $household->id)
            ->withCount('members')
            ->orderByDesc('id')
            ->get(['id', 'census_no', 'status', 'household_head_name', 'created_at']);

        return $this->success([
            'exists' => true,
            'household' => $household->only([
                'id', 'household_number', 'zone_purok', 'street_address',
            ]) + ['head' => $household->head?->only([
                'id', 'resident_number', 'first_name', 'last_name',
            ])],
            'residents' => $residents,
            'resident_count' => $residents->count(),
            'censuses' => $censuses,
        ], $residents->count() . ' person(s) are already recorded in household '
            . $number . '.');
    }
}
