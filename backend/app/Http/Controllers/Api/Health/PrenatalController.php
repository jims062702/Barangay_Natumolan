<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Models\Resident\Resident;
use App\Services\Health\PregnancyRegister;
use App\Services\Health\RegisteredPerson;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Prenatal Records — the station's handwritten prenatal register, a line
 * per visit: Date, Zone, Name, Age, WT, BP, HT, LMP, EDC, MOS, Contact #.
 *
 * Every line belongs to ONE PREGNANCY. That is what makes the mother's
 * "Prenatal Visits" the visits of her current pregnancy — a COUNT of its
 * records, asked of the database every time — and a line's "Visit #" its
 * place among that pregnancy's records by date. Neither is ever typed, and
 * neither is stored, so neither can drift.
 *
 * THE MOTHER IS A RESIDENT — a woman on the Population Office's register.
 * Her age, zone and contact on the line are set here from her record there,
 * as they stand on the day of the visit; the station never types them, and
 * a woman not yet on the register is registered by the Population Office
 * first.
 *
 * Values are kept as the staff wrote them — "110/70", "57.8", "8 mos" —
 * and nothing is concluded from them.
 */
class PrenatalController extends BaseController
{
    public function __construct(
        private readonly PregnancyRegister $register,
        private readonly RegisteredPerson $people,
    ) {
    }

    /** The register, newest first. */
    public function index(Request $request)
    {
        $query = PrenatalVisit::query()
            ->select('prenatal_visits.*')
            ->join('maternal_health as preg', 'preg.id', '=', 'prenatal_visits.pregnancy_id')
            ->join('residents as m', 'm.id', '=', 'prenatal_visits.mother_id')
            ->with(['pregnancy', 'mother:id,resident_number', 'recorder:id,name'])
            ->when($request->filled('pregnancy_id'), fn ($q) => $q->where('prenatal_visits.pregnancy_id', (int) $request->pregnancy_id))
            ->when($request->filled('status'), fn ($q) => $q->where('preg.status', $request->status))
            ->when($request->filled('zone_purok'), fn ($q) => $q->where('prenatal_visits.zone_purok', $request->zone_purok))
            ->when($request->filled('year'), fn ($q) => $q->whereYear('prenatal_visits.visit_date', (int) $request->year))
            ->when($request->filled('month'), fn ($q) => $q->whereMonth('prenatal_visits.visit_date', (int) $request->month))
            ->when($request->filled('search'), fn ($q) => $this->search($q, trim((string) $request->search)))
            ->orderByDesc('prenatal_visits.visit_date')
            ->orderByDesc('prenatal_visits.id');

        $page = $query->paginate(20);
        $rows = $page->getCollection();
        $visitNumbers = $this->register->visitNumbers($rows->pluck('pregnancy_id')->all());
        $pregnancies = $rows->pluck('pregnancy')->unique('id')->values();
        $pregnancyNumbers = $this->register->numbers($pregnancies);
        $counts = $this->counts($pregnancies->pluck('id')->all());

        $page->setCollection($rows->map(fn (PrenatalVisit $v) => $this->row($v, $visitNumbers, $pregnancyNumbers, $counts)));

        return $this->success($page, 'Prenatal records retrieved');
    }

    /**
     * A new line on the register.
     *
     * 1. the mother's current pregnancy is found — or, when the staff say so,
     *    started with this record
     * 2. the record is saved to it
     * 3. its Prenatal Visits is counted again and sent back
     */
    public function store(Request $request)
    {
        $data = $request->validate($this->rules() + [
            'pregnancy_id' => 'nullable|required_without:mother_id|exists:maternal_health,id',
            'mother_id' => 'nullable|integer',
            'start_pregnancy' => 'boolean',
        ], $this->messages() + [
            'pregnancy_id.required_without' => 'Choose the mother from the register.',
        ]);

        [$visit, $pregnancy] = DB::transaction(function () use ($data) {
            $pregnancy = $this->pregnancyFor($data);
            $mother = $pregnancy->mother;

            $visit = PrenatalVisit::create($this->fields($data) + $this->fromRegister($mother, $data['visit_date']) + [
                'pregnancy_id' => $pregnancy->id,
                'mother_id' => $mother->id,
                'recorded_by' => auth()->id(),
            ]);

            /* The pregnancy's LMP and EDC, when it has none yet, are the
               ones written on its record — copied, never worked out. */
            $pregnancy->fill(array_filter([
                'lmp' => $pregnancy->lmp ? null : ($data['lmp'] ?? null),
                'expected_delivery_date' => $pregnancy->expected_delivery_date ? null : ($data['edc'] ?? null),
            ]));
            if ($pregnancy->isDirty()) {
                $pregnancy->save();
            }

            return [$visit, $pregnancy];
        });

        return $this->success($this->saved($visit, $pregnancy), 'Prenatal record saved', 201);
    }

    /**
     * Correcting a line. The same record, so no visit is added — and its
     * Visit # follows its date. Moved to another of the SAME mother's
     * pregnancies, both are counted again.
     */
    public function update(Request $request, PrenatalVisit $visit)
    {
        $data = $request->validate($this->rules() + [
            'pregnancy_id' => 'nullable|exists:maternal_health,id',
        ], $this->messages());

        /* What the form did not send stays as it was: correcting the BP
           must not blank the LMP. */
        $data += collect($visit->only(array_keys($this->fields(['visit_date' => null]))))
            ->map(fn ($v) => $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : $v)->all();

        $from = $visit->pregnancy;
        $to = ! empty($data['pregnancy_id']) ? MaternalRecord::findOrFail($data['pregnancy_id']) : $from;

        if ($to->id !== $from->id && ! $this->sameMother($from, $to)) {
            throw ValidationException::withMessages([
                'pregnancy_id' => 'A prenatal record can only be moved to another pregnancy of the same mother.',
            ]);
        }

        $visit->update($this->fields($data) + [
            /* The age is her age ON the visit, so it follows the date; the
               zone and contact stay as they were that day. */
            'age' => $this->ageOn($to->mother, $data['visit_date']),
            'pregnancy_id' => $to->id,
            'mother_id' => $to->mother_id,
            'updated_by' => auth()->id(),
        ]);

        $payload = $this->saved($visit->fresh(), $to->fresh());
        if ($to->id !== $from->id) {
            $payload['previous_pregnancy'] = $this->summary($from->fresh());
        }

        return $this->success($payload, 'Prenatal record updated');
    }

    /** A line entered in error. Its pregnancy is counted again, one fewer. */
    public function destroy(PrenatalVisit $visit)
    {
        $pregnancy = $visit->pregnancy;
        $visit->delete();

        return $this->success(['pregnancy' => $this->summary($pregnancy->fresh())], 'Prenatal record deleted');
    }

    /* ------------------------------------------------------------------ */

    /**
     * The pregnancy this record belongs to.
     *
     * Given: it must still be current — a completed pregnancy's register is
     * closed. A mother: her current pregnancy; with none, one is started
     * only when the staff asked for it (start_pregnancy), dated this visit.
     */
    private function pregnancyFor(array $data): MaternalRecord
    {
        if (! empty($data['pregnancy_id'])) {
            $pregnancy = MaternalRecord::lockForUpdate()->findOrFail($data['pregnancy_id']);
            if (! $pregnancy->isActive()) {
                throw ValidationException::withMessages([
                    'pregnancy_id' => 'This pregnancy is already completed. Register her new pregnancy first.',
                ]);
            }

            return $pregnancy;
        }

        $mother = $this->people->woman($data['mother_id'] ?? null, 'mother_id', living: true);
        Resident::whereKey($mother->id)->lockForUpdate()->first();

        $active = $this->register->activeFor($mother->id);
        if ($active) {
            return $active;
        }

        if (empty($data['start_pregnancy'])) {
            throw ValidationException::withMessages([
                'start_pregnancy' => "{$mother->full_name} has no current pregnancy. Confirm that this record starts a new one.",
            ]);
        }

        return MaternalRecord::create([
            'mother_id' => $mother->id,
            'pregnancy_registration_date' => $data['visit_date'],
            'lmp' => $data['lmp'] ?? null,
            'expected_delivery_date' => $data['edc'] ?? null,
            'status' => MaternalRecord::ACTIVE,
            'created_by' => auth()->id(),
        ]);
    }

    /** Her age on the day, her zone and her contact — from the register, never typed. */
    private function fromRegister(Resident $mother, string $visitDate): array
    {
        return [
            'age' => $this->ageOn($mother, $visitDate),
            'zone_purok' => $mother->zone_purok,
            'contact_number' => $mother->contact_number,
        ];
    }

    private function ageOn(?Resident $mother, string $day): ?int
    {
        return $mother?->birthdate ? $mother->birthdate->diff(Carbon::parse($day))->y : null;
    }

    private function sameMother(MaternalRecord $a, MaternalRecord $b): bool
    {
        return (int) $a->mother_id === (int) $b->mother_id;
    }

    private function search(Builder $q, string $term): void
    {
        $like = '%' . $term . '%';
        $q->where(fn ($w) => $w->whereRaw("CONCAT_WS(' ', m.first_name, m.middle_name, m.last_name) LIKE ?", [$like])
            ->orWhere('m.resident_number', 'like', $like)
            ->orWhere('prenatal_visits.zone_purok', 'like', $like)
            ->orWhere('m.contact_number', 'like', $like));
    }

    /** @return array<int, int> pregnancy id => its records */
    private function counts(array $pregnancyIds): array
    {
        if (! $pregnancyIds) {
            return [];
        }

        return DB::table('prenatal_visits')->whereIn('pregnancy_id', $pregnancyIds)
            ->groupBy('pregnancy_id')->selectRaw('pregnancy_id, count(*) as n')
            ->pluck('n', 'pregnancy_id')->map(fn ($n) => (int) $n)->all();
    }

    private function row(PrenatalVisit $v, array $visitNumbers, array $pregnancyNumbers, array $counts): array
    {
        $p = $v->pregnancy;
        $total = $counts[$p->id] ?? 0;

        return [
            'id' => $v->id,
            'pregnancy_id' => $p->id,
            'pregnancy_number' => $pregnancyNumbers[$p->id] ?? 1,
            'pregnancy_status' => $p->status,
            'visit_number' => $visitNumbers[$v->id] ?? null,
            'pregnancy_visits' => $total,
            'current_prenatal_visits' => $p->isActive() ? $total : 0,
            'visit_date' => $v->visit_date?->toDateString(),
            'zone_purok' => $v->zone_purok,
            'mother_id' => $v->mother_id,
            'mother_name' => $p->motherDisplayName(),
            'mother_resident_number' => $v->mother?->resident_number,
            'age' => $v->age,
            'weight_kg' => $v->weight_kg,
            'blood_pressure' => $v->blood_pressure,
            'height_cm' => $v->height_cm,
            'lmp' => $v->lmp?->toDateString(),
            'edc' => $v->edc?->toDateString(),
            'months_of_pregnancy' => $v->months_of_pregnancy,
            'contact_number' => $v->contact_number,
            'complaint' => $v->complaint,
            'recorded_by' => $v->recorder?->name,
            'version' => $v->updated_at?->toIso8601String(),
        ];
    }

    /** What a save sends back: the record, its Visit #, and its pregnancy counted again. */
    private function saved(PrenatalVisit $visit, MaternalRecord $pregnancy): array
    {
        $visit->load(['pregnancy', 'mother:id,resident_number', 'recorder:id,name']);
        $numbers = $this->register->visitNumbers([$pregnancy->id]);
        $pregnancyNumbers = $this->register->numbers(collect([$visit->pregnancy]));

        return [
            'record' => $this->row($visit, $numbers, $pregnancyNumbers, $this->counts([$pregnancy->id])),
            'pregnancy' => $this->summary($pregnancy),
        ];
    }

    /** A pregnancy as the "Current Pregnancy" card shows it. */
    private function summary(MaternalRecord $p): array
    {
        $count = $p->prenatalVisits()->count();

        return [
            'id' => $p->id,
            'pregnancy_number' => $this->register->numbers(collect([$p]))[$p->id] ?? 1,
            'status' => $p->status,
            'prenatal_visits' => $count,
            'current_prenatal_visits' => $p->isActive() ? $count : 0,
            'last_visit_date' => $p->prenatalVisits()->max('visit_date'),
            'lmp' => $p->lmp?->toDateString(),
            'expected_delivery_date' => $p->expected_delivery_date?->toDateString(),
        ];
    }

    private function fields(array $data): array
    {
        return [
            'visit_date' => $data['visit_date'],
            'weight_kg' => $data['weight_kg'] ?? null,
            'blood_pressure' => isset($data['blood_pressure']) ? preg_replace('/\s+/', '', $data['blood_pressure']) : null,
            'height_cm' => $data['height_cm'] ?? null,
            'lmp' => $data['lmp'] ?? null,
            'edc' => $data['edc'] ?? null,
            'months_of_pregnancy' => isset($data['months_of_pregnancy']) ? trim($data['months_of_pregnancy']) : null,
            'complaint' => $data['complaint'] ?? null,
        ];
    }

    private function rules(): array
    {
        $today = ManilaTime::today();

        return [
            'visit_date' => 'required|date|before_or_equal:' . $today,
            'weight_kg' => 'nullable|numeric|between:20,200',
            /* "110/70" — two numbers and a slash, as the register writes it. */
            'blood_pressure' => ['nullable', 'string', 'max:20', 'regex:/^\d{2,3}\s*\/\s*\d{2,3}$/'],
            'height_cm' => 'nullable|numeric|between:100,220',
            'lmp' => 'nullable|date|before_or_equal:visit_date',
            'edc' => 'nullable|date|after_or_equal:visit_date',
            'months_of_pregnancy' => 'nullable|string|max:20',
            'complaint' => 'nullable|string|max:2000',
        ];
    }

    private function messages(): array
    {
        return [
            'visit_date.before_or_equal' => 'A prenatal record cannot be dated in the future.',
            'blood_pressure.regex' => 'Write the BP as systolic/diastolic, e.g. 110/70.',
            'lmp.before_or_equal' => 'The LMP cannot be after the date of the record.',
            'edc.after_or_equal' => 'The EDC cannot be before the date of the record.',
            'weight_kg.between' => 'Check the weight (kg).',
            'height_cm.between' => 'Check the height (cm).',
        ];
    }
}
