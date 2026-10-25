<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ImmunizationProfile;
use App\Models\Health\ImmunizationRecord;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Immunization, kept the way the DOH Individual Treatment Record keeps it: a
 * CARD per person — a few once-only facts and one date per vaccine.
 *
 * Three endpoints:
 *
 *   index — every dose given, newest first; the station's register
 *   card  — one person's card, as the form lays it out
 *   save  — the card written back in one go
 *
 * There is no longer a one-dose-at-a-time writer, nor Pending/Missed statuses.
 * The paper card records the day a dose was GIVEN and nothing else; a dose on
 * this card is a dose given.
 */
class ImmunizationController extends BaseController
{
    private const PERSON_COLUMNS =
        'id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,gender,birthdate,address';

    public function index(Request $request)
    {
        $query = ImmunizationRecord::with(['child:' . self::PERSON_COLUMNS]);

        if ($request->filled('child_id')) {
            $query->where('child_id', $request->child_id);
        }

        $records = $query->orderByDesc('vaccination_date')->orderByDesc('id')->get();

        // Also include profiles if they have booster / others / screening or no records
        $profileQuery = ImmunizationProfile::with(['resident:' . self::PERSON_COLUMNS]);
        if ($request->filled('child_id')) {
            $profileQuery->where('resident_id', $request->child_id);
        }
        $profiles = $profileQuery->get();

        $extraRecords = collect();
        foreach ($profiles as $prof) {
            if (!$prof->resident) {
                continue;
            }

            $residentRecords = $records->where('child_id', $prof->resident_id);

            // If profile has booster and resident has no COVID booster record
            if ($prof->booster && !$residentRecords->contains('vaccine_name', 'COVID booster')) {
                $item = new ImmunizationRecord([
                    'id' => 'profile-booster-' . $prof->id,
                    'child_id' => $prof->resident_id,
                    'vaccine_name' => 'Booster (' . $prof->booster . ')',
                    'vaccination_date' => $prof->updated_at?->toDateString() ?? now()->toDateString(),
                    'status' => 'Completed',
                    'notes' => $prof->booster,
                ]);
                $item->setRelation('child', $prof->resident);
                $extraRecords->push($item);
            }

            // If profile has newborn screening and resident has no screening record
            if ($prof->newborn_screening_date && !$residentRecords->contains('vaccine_name', 'Newborn Screening')) {
                $item = new ImmunizationRecord([
                    'id' => 'profile-screening-' . $prof->id,
                    'child_id' => $prof->resident_id,
                    'vaccine_name' => 'Newborn Screening',
                    'vaccination_date' => $prof->newborn_screening_date->toDateString(),
                    'status' => 'Completed',
                ]);
                $item->setRelation('child', $prof->resident);
                $extraRecords->push($item);
            }

            // If resident has an immunization profile and zero dose records at all
            if ($residentRecords->isEmpty() && !$prof->booster && !$prof->newborn_screening_date) {
                $item = new ImmunizationRecord([
                    'id' => 'profile-card-' . $prof->id,
                    'child_id' => $prof->resident_id,
                    'vaccine_name' => $prof->others ? 'Other: ' . $prof->others : 'Immunization Card Record',
                    'vaccination_date' => $prof->updated_at?->toDateString() ?? now()->toDateString(),
                    'status' => 'Completed',
                    'notes' => $prof->others,
                ]);
                $item->setRelation('child', $prof->resident);
                $extraRecords->push($item);
            }
        }

        $all = $records->concat($extraRecords)
            ->sortByDesc(fn ($r) => $r->vaccination_date ? (is_string($r->vaccination_date) ? $r->vaccination_date : $r->vaccination_date->toDateString()) : '')
            ->values();

        $page = (int) $request->input('page', 1);
        $perPage = 20;
        $total = $all->count();
        $items = $all->forPage($page, $perPage)->values();

        $paginator = new \Illuminate\Pagination\LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return $this->success(
            $paginator,
            'Immunization records retrieved'
        );
    }

    /**
     * The DOH routine schedule for infants: how many days old a child is when
     * each dose falls due.
     *
     * Hep B is one entry satisfied by EITHER box on the card — "within 24 hrs"
     * and "after 24 hrs" are the same dose given early or late, and a child
     * who got it late is not still owed it.
     */
    private const DUE_AT_DAYS = [
        'BCG' => 0,
        'Hep B' => 0,
        'Penta 1' => 42, 'OPV 1' => 42, 'PCV 1' => 42,
        'Penta 2' => 70, 'OPV 2' => 70, 'PCV 2' => 70,
        'Penta 3' => 98, 'OPV 3' => 98, 'PCV 3' => 98, 'IPV' => 98,
        'MCV 1' => 274,
        'MCV 2' => 365,
    ];

    /** A dose is "due" for four weeks after its day, then "overdue". */
    private const GRACE_DAYS = 28;

    /**
     * Doses a child should have had by now and does not.
     *
     * WORKED OUT, NOT TYPED. The card records the day a dose was given and
     * nothing else, so "due" and "missed" cannot be statuses somebody sets —
     * the dashboard that read them would have said "great coverage" forever.
     * They are what the DOH schedule and the child's birth date say is owed,
     * against what the card shows was given.
     *
     * Children under two only: every routine infant dose falls due within the
     * first year, and the list is for the ones a BHW can still catch up.
     */
    public function due()
    {
        $today = now()->startOfDay();

        $children = Resident::where('birthdate', '>=', $today->copy()->subYears(2))
            ->where('birthdate', '<=', $today)
            ->where('record_type', '!=', Resident::NON_RESIDENT)
            ->get(explode(',', self::PERSON_COLUMNS));

        $given = ImmunizationRecord::whereIn('child_id', $children->pluck('id'))
            ->get(['child_id', 'vaccine_name'])
            ->groupBy('child_id')
            ->map(fn ($rows) => $rows->pluck('vaccine_name')->all());

        $owed = [];

        foreach ($children as $child) {
            $ageDays = (int) $child->birthdate->diffInDays($today);
            $has = $given[$child->id] ?? [];

            foreach (self::DUE_AT_DAYS as $dose => $dueAt) {
                if ($ageDays < $dueAt) {
                    continue;
                }

                $done = $dose === 'Hep B'
                    ? (in_array('Hep B within 24 hrs', $has, true) || in_array('Hep B after 24 hrs', $has, true))
                    : in_array($dose, $has, true);

                if ($done) {
                    continue;
                }

                $owed[] = [
                    'child_id' => $child->id,
                    'name' => $child->full_name,
                    'zone_purok' => $child->zone_purok,
                    'age_days' => $ageDays,
                    'vaccine' => $dose,
                    'due_on' => $child->birthdate->copy()->addDays($dueAt)->toDateString(),
                    'state' => $ageDays > $dueAt + self::GRACE_DAYS ? 'Overdue' : 'Due',
                ];
            }
        }

        /* Longest-owed first: that is the child to visit today. */
        usort($owed, fn ($a, $b) => strcmp($a['due_on'], $b['due_on']));

        return $this->success([
            'doses' => $owed,
            'children_checked' => $children->count(),
        ], 'Doses due retrieved');
    }

    /** One person's card, laid out as the form lays it out. */
    public function card(Resident $resident)
    {
        $profile = ImmunizationProfile::where('resident_id', $resident->id)->first();

        /*
         * The dose dates keyed by vaccine name, and only the names on the
         * form. A row recorded under some older free-typed name ("MMR") is
         * not lost — it is still on the register — it just has no box on
         * this card to sit in.
         */
        $doses = ImmunizationRecord::where('child_id', $resident->id)
            ->whereIn('vaccine_name', ImmunizationRecord::vaccines())
            ->orderBy('vaccination_date')
            ->get()
            ->mapWithKeys(fn ($r) => [$r->vaccine_name => $r->vaccination_date?->toDateString()]);

        return $this->success([
            /* Read from the register, never asked again on the card: the
               name, zone, sex and address are the resident record's. */
            'resident' => $resident->only([
                'id', 'resident_number', 'full_name', 'zone_purok', 'gender', 'birthdate', 'address',
            ]),
            'profile' => $profile,
            'doses' => $doses,
            'child_vaccines' => ImmunizationRecord::CHILD_VACCINES,
            'adult_vaccines' => ImmunizationRecord::ADULT_VACCINES,
            'delivery_types' => ImmunizationProfile::DELIVERY_TYPES,
        ], 'Immunization card retrieved');
    }

    /**
     * The card, written back in one go.
     *
     * `doses` is a map of vaccine name to the date it was given. A date sets
     * or corrects that dose; an EMPTY value removes a dose that was recorded
     * — that is how a wrong entry on the card is taken back. A vaccine left
     * out of the map is not touched at all, so a partial save (a device
     * coming back online with half a card) cannot wipe the rest.
     */
    public function save(Request $request, Resident $resident)
    {
        $validated = $request->validate([
            'newborn_screening_date' => 'nullable|date|before_or_equal:today',
            'delivery_type' => 'nullable|in:' . implode(',', ImmunizationProfile::DELIVERY_TYPES),
            /* Newborn bounds, so a birth weight typed in grams (3200) or a
               length in inches is caught here rather than printed. */
            'birth_weight_kg' => 'nullable|numeric|between:0.3,7',
            'birth_length_cm' => 'nullable|numeric|between:20,70',
            'others' => 'nullable|string|max:500',
            'booster' => 'nullable|string|max:500',
            'doses' => 'nullable|array',
            'doses.*' => 'nullable|date|before_or_equal:today',
        ], [
            'birth_weight_kg.between' => 'Birth weight is in kilograms — between 0.3 and 7.',
            'birth_length_cm.between' => 'Birth length is in centimetres — between 20 and 70.',
            'doses.*.before_or_equal' => 'A dose cannot be recorded as given in the future.',
        ]);

        $doses = $validated['doses'] ?? [];

        /* Only the names on the form. Anything else is refused by name, so
           the list stays one the paper card can be checked against. */
        $unknown = array_diff(array_keys($doses), ImmunizationRecord::vaccines());
        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'doses' => 'Not on the immunization record: ' . implode(', ', $unknown) . '.',
            ]);
        }

        /* A dose before the person was born is a mistyped year. */
        if ($resident->birthdate) {
            $born = $resident->birthdate->toDateString();
            $early = array_keys(array_filter($doses, fn ($d) => $d && $d < $born));

            if ($early !== []) {
                throw ValidationException::withMessages([
                    'doses' => implode(', ', $early) . ' — dated before ' . $resident->first_name
                        . ' was born (' . $born . '). Check the year.',
                ]);
            }
        }

        DB::transaction(function () use ($validated, $doses, $resident) {
            ImmunizationProfile::updateOrCreate(
                ['resident_id' => $resident->id],
                collect($validated)->except('doses')->all() + ['recorded_by' => auth()->id()],
            );

            // If booster was entered in profile and not explicitly passed in doses['COVID booster']
            $boosterText = trim($validated['booster'] ?? '');
            if ($boosterText !== '' && empty($doses['COVID booster'])) {
                $boosterRow = ImmunizationRecord::firstOrNew([
                    'child_id' => $resident->id,
                    'vaccine_name' => 'COVID booster',
                ]);
                $boosterRow->vaccination_date = $boosterRow->vaccination_date ?? now()->toDateString();
                $boosterRow->status = 'Completed';
                $boosterRow->administered_by ??= auth()->id();
                $boosterRow->notes = $boosterText;
                $boosterRow->save();
            }

            foreach ($doses as $vaccine => $date) {
                if ($date) {
                    $row = ImmunizationRecord::firstOrNew([
                        'child_id' => $resident->id,
                        'vaccine_name' => $vaccine,
                    ]);
                    $row->vaccination_date = $date;
                    $row->status = 'Completed';
                    /* Whoever first recorded the dose keeps the credit; a
                       later correction of its date does not change who gave it. */
                    $row->administered_by ??= auth()->id();
                    $row->save();
                } else {
                    ImmunizationRecord::where('child_id', $resident->id)
                        ->where('vaccine_name', $vaccine)
                        ->delete();
                }
            }
        });

        return $this->card($resident->fresh());
    }
}
