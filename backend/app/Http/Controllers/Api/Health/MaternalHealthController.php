<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Health\StoreMaternalHealthRequest;
use App\Models\Health\MaternalRecord;
use App\Models\Resident\Resident;
use App\Services\Health\PregnancyRegister;
use App\Services\Health\RegisteredPerson;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Maternal Health — one record per PREGNANCY, and a mother's history is all
 * of them.
 *
 * It was one record per mother, saved over on every pregnancy, with its
 * prenatal visit count typed in. Now:
 *
 *   - a mother has at most ONE current (Active) pregnancy
 *   - its "Prenatal Visits" is COUNT(its prenatal records), never stored
 *   - completing it (Delivered, or Closed with the staff's reason) ends it;
 *     its records stay with it, and her next pregnancy starts at 0
 *
 * THE MOTHER IS A RESIDENT. She is a woman on the Population Office's
 * register — checked here, not only in the picker — and her age, zone,
 * address and contact are read from her record there, never typed on the
 * pregnancy. A woman not yet on the register is registered by the
 * Population Office first.
 *
 * Nothing here judges a pregnancy. The only words it uses about one are the
 * ones the staff chose.
 */
class MaternalHealthController extends BaseController
{
    public function __construct(
        private readonly PregnancyRegister $register,
        private readonly RegisteredPerson $people,
    ) {
    }

    /** Pregnancies, newest registration first. */
    public function index(Request $request)
    {
        $query = MaternalRecord::query()
            ->select('maternal_health.*')
            ->join('residents as m', 'm.id', '=', 'maternal_health.mother_id')
            ->with('mother')
            ->withCount('prenatalVisits')
            ->withMax('prenatalVisits as last_visit_date', 'visit_date')
            ->when($request->filled('status'), fn ($q) => $q->where('maternal_health.status', $request->status))
            ->when($request->filled('zone_purok'), fn ($q) => $q->where('m.zone_purok', $request->zone_purok))
            ->when($request->filled('year'), fn ($q) => $q->whereYear('pregnancy_registration_date', (int) $request->year))
            ->when($request->filled('month'), fn ($q) => $q->whereMonth('pregnancy_registration_date', (int) $request->month))
            ->when($request->filled('search'), fn ($q) => $this->search($q, trim((string) $request->search)))
            ->orderByDesc('pregnancy_registration_date')
            ->orderByDesc('maternal_health.id');

        $page = $query->paginate(20);
        $numbers = $this->register->numbers($page->getCollection());
        $page->getCollection()->transform(fn (MaternalRecord $p) => $this->row($p, $numbers[$p->id] ?? 1));

        return $this->success($page, 'Maternal health records retrieved');
    }

    /** One pregnancy, with its mother's whole history. */
    public function show(MaternalRecord $pregnancy)
    {
        return $this->success($this->motherView($pregnancy), 'Maternal health record retrieved');
    }

    /**
     * A woman on the register, as the pregnancy and prenatal forms need her:
     * her details, her current pregnancy if she has one, and every pregnancy
     * before it.
     */
    public function forMother(Resident $resident)
    {
        $mother = $this->people->woman($resident->id);
        $latest = MaternalRecord::where('mother_id', $mother->id)
            ->orderByRaw("status = 'Active' DESC")->orderByDesc('pregnancy_registration_date')->orderByDesc('id')
            ->first();

        if ($latest) {
            return $this->success($this->motherView($latest), 'Mother found');
        }

        return $this->success([
            'mother' => $this->person($mother),
            'current' => null,
            'selected' => null,
            'pregnancies' => [],
            'next_pregnancy_number' => 1,
        ], 'Mother found');
    }

    /** A new pregnancy — never a second current one for the same mother. */
    public function store(StoreMaternalHealthRequest $request)
    {
        $data = $request->validated();

        $pregnancy = DB::transaction(function () use ($data) {
            $mother = $this->people->woman($data['mother_id'], 'mother_id', living: true);
            Resident::whereKey($mother->id)->lockForUpdate()->first();
            $this->refuseSecondActive($mother);

            return MaternalRecord::create($this->pregnancyFields($data) + [
                'mother_id' => $mother->id,
                'status' => MaternalRecord::ACTIVE,
                'created_by' => auth()->id(),
            ]);
        });

        return $this->success($this->motherView($pregnancy), 'Pregnancy registered', 201);
    }

    /**
     * Correcting a pregnancy's own details. The mother is not changed here —
     * her records are hers — and her status changes only through complete
     * and reopen.
     */
    public function update(StoreMaternalHealthRequest $request, MaternalRecord $pregnancy)
    {
        /* What the form did not send stays as it was. */
        $data = $request->validated() + collect($pregnancy->only([
            'lmp', 'expected_delivery_date', 'risk_indicators', 'referral_to_hospital', 'referral_reason',
            'family_planning_method', 'family_planning_counseling_notes', 'maternal_immunization_received',
            'post_natal_followup_required',
        ]))->map(fn ($v) => $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : $v)->all();

        $pregnancy->update($this->pregnancyFields($data) + ['updated_by' => auth()->id()]);

        return $this->success($this->motherView($pregnancy->fresh()), 'Maternal health record updated');
    }

    /**
     * The pregnancy is over: Delivered on a date, or Closed with the staff's
     * own reason. Nothing is concluded about the outcome beyond what is
     * entered. Its prenatal records stay; the mother's current count is 0
     * until her next pregnancy is registered.
     */
    public function complete(Request $request, MaternalRecord $pregnancy)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([MaternalRecord::DELIVERED, MaternalRecord::CLOSED])],
            'actual_delivery_date' => [
                'required_if:status,Delivered', 'nullable', 'date',
                'after_or_equal:' . $pregnancy->pregnancy_registration_date?->toDateString(),
                'before_or_equal:' . ManilaTime::today(),
            ],
            'closure_note' => 'required_if:status,Closed|nullable|string|max:255',
        ], [
            'actual_delivery_date.required_if' => 'Enter the delivery date.',
            'actual_delivery_date.after_or_equal' => 'The delivery date cannot be before the pregnancy was registered.',
            'actual_delivery_date.before_or_equal' => 'The delivery date cannot be in the future.',
            'closure_note.required_if' => 'Say why the record is being closed.',
        ]);

        if (! $pregnancy->isActive()) {
            throw ValidationException::withMessages(['status' => 'This pregnancy is already completed.']);
        }

        $pregnancy->update([
            'status' => $data['status'],
            'actual_delivery_date' => $data['status'] === MaternalRecord::DELIVERED ? $data['actual_delivery_date'] : null,
            'closure_note' => $data['status'] === MaternalRecord::CLOSED ? trim($data['closure_note']) : null,
            'completed_at' => ManilaTime::today(),
            'completed_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return $this->success($this->motherView($pregnancy->fresh()), 'Pregnancy completed');
    }

    /** Undoing a completion made in error — only while she has no other current pregnancy. */
    public function reopen(MaternalRecord $pregnancy)
    {
        if ($pregnancy->isActive()) {
            throw ValidationException::withMessages(['status' => 'This pregnancy is still current.']);
        }

        DB::transaction(function () use ($pregnancy) {
            $mother = Resident::whereKey($pregnancy->mother_id)->lockForUpdate()->firstOrFail();
            $this->refuseSecondActive($mother, $pregnancy->id);

            $pregnancy->update([
                'status' => MaternalRecord::ACTIVE,
                'actual_delivery_date' => null,
                'closure_note' => null,
                'completed_at' => null,
                'completed_by' => null,
                'updated_by' => auth()->id(),
            ]);
        });

        return $this->success($this->motherView($pregnancy->fresh()), 'Pregnancy reopened');
    }

    /** A pregnancy registered in error. One with prenatal records is kept. */
    public function destroy(MaternalRecord $pregnancy)
    {
        $visits = $pregnancy->prenatalVisits()->count();
        if ($visits > 0) {
            throw ValidationException::withMessages([
                'pregnancy' => "This pregnancy has {$visits} prenatal " . ($visits === 1 ? 'record' : 'records')
                    . ' and cannot be deleted. Complete or close it instead.',
            ]);
        }

        $pregnancy->delete();

        return $this->success(null, 'Maternal health record deleted');
    }

    /* ------------------------------------------------------------------ */

    private function search(Builder $q, string $term): void
    {
        $like = '%' . $term . '%';
        $q->where(fn ($w) => $w->whereRaw("CONCAT_WS(' ', m.first_name, m.middle_name, m.last_name) LIKE ?", [$like])
            ->orWhere('m.resident_number', 'like', $like)
            ->orWhere('m.zone_purok', 'like', $like)
            ->orWhere('m.contact_number', 'like', $like));
    }

    /** At most one current pregnancy per mother. */
    private function refuseSecondActive(Resident $mother, ?int $except = null): void
    {
        $active = MaternalRecord::active()
            ->where('mother_id', $mother->id)
            ->when($except, fn ($q) => $q->whereKeyNot($except))
            ->first();

        if ($active) {
            throw ValidationException::withMessages([
                'mother_id' => "{$mother->full_name} already has a current pregnancy, registered "
                    . Carbon::parse($active->pregnancy_registration_date)->format('F j, Y')
                    . '. Complete it before registering a new one.',
            ]);
        }
    }

    /** The pregnancy's own details — nothing about who the mother is. */
    private function pregnancyFields(array $data): array
    {
        return [
            'pregnancy_registration_date' => $data['pregnancy_registration_date'],
            'lmp' => $data['lmp'] ?? null,
            'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
            'risk_indicators' => $data['risk_indicators'] ?? null,
            'referral_to_hospital' => (bool) ($data['referral_to_hospital'] ?? false),
            'referral_reason' => $data['referral_reason'] ?? null,
            'family_planning_method' => $data['family_planning_method'] ?? null,
            'family_planning_counseling_notes' => $data['family_planning_counseling_notes'] ?? null,
            'maternal_immunization_received' => (bool) ($data['maternal_immunization_received'] ?? false),
            'post_natal_followup_required' => (bool) ($data['post_natal_followup_required'] ?? false),
        ];
    }

    /** Her age on a given day, from the register's birth date. */
    private function ageOn(?Resident $mother, ?string $day): ?int
    {
        if (! $mother?->birthdate || ! $day) {
            return null;
        }

        return $mother->birthdate->diff(Carbon::parse($day))->y;
    }

    /** One line of the list. */
    private function row(MaternalRecord $p, int $number): array
    {
        $visits = (int) $p->prenatal_visits_count;
        $mother = $p->mother;

        return [
            'id' => $p->id,
            'pregnancy_number' => $number,
            'mother_id' => $p->mother_id,
            'mother_name' => $mother?->full_name,
            'mother_resident_number' => $mother?->resident_number,
            /* Her age when the pregnancy was registered — from the register. */
            'mother_age' => $this->ageOn($mother, $p->pregnancy_registration_date?->toDateString()),
            'zone_purok' => $mother?->zone_purok,
            'contact_number' => $mother?->contact_number,
            'pregnancy_registration_date' => $p->pregnancy_registration_date?->toDateString(),
            'lmp' => $p->lmp?->toDateString(),
            'expected_delivery_date' => $p->expected_delivery_date?->toDateString(),
            'actual_delivery_date' => $p->actual_delivery_date?->toDateString(),
            'status' => $p->status,
            'completed_at' => $p->completed_at?->toDateString(),
            'prenatal_visits' => $visits,
            /* "Prenatal Visits" as the spec means it: the CURRENT pregnancy's
               count, which a completed one no longer has. */
            'current_prenatal_visits' => $p->isActive() ? $visits : 0,
            'last_visit_date' => $p->last_visit_date ? Carbon::parse($p->last_visit_date)->toDateString() : null,
            /* The version an edit is typed against — see useModalDraft. */
            'version' => $p->updated_at?->toIso8601String(),
        ];
    }

    /**
     * The mother's page: who she is (the register), her current pregnancy,
     * every pregnancy she has had here, and the prenatal records of the one
     * asked for.
     */
    private function motherView(MaternalRecord $selected): array
    {
        $all = MaternalRecord::query()
            ->withCount('prenatalVisits')
            ->withMax('prenatalVisits as last_visit_date', 'visit_date')
            ->with('mother', 'completedBy:id,name')
            ->where('mother_id', $selected->mother_id)
            ->orderBy('pregnancy_registration_date')->orderBy('id')
            ->get();

        $numbers = $this->register->numbers($all);
        $rows = $all->map(fn (MaternalRecord $p) => $this->row($p, $numbers[$p->id] ?? 1) + [
            'risk_indicators' => $p->risk_indicators,
            'referral_to_hospital' => $p->referral_to_hospital,
            'referral_reason' => $p->referral_reason,
            'closure_note' => $p->closure_note,
            'completed_by' => $p->completedBy?->name,
        ]);

        $current = $rows->firstWhere('status', MaternalRecord::ACTIVE);
        $selectedRow = $rows->firstWhere('id', $selected->id);

        $visitList = $selected->prenatalVisits()->with('recorder:id,name')
            ->orderByDesc('visit_date')->orderByDesc('id')->get();
        $visitNumbers = $this->register->visitNumbers([$selected->id]);

        return [
            'mother' => $this->person($selected->mother),
            'current' => $current,
            'selected' => $selectedRow,
            /* Newest first to read; numbered oldest first. */
            'pregnancies' => $rows->reverse()->values(),
            'next_pregnancy_number' => $rows->count() + 1,
            'visits' => $visitList->map(fn ($v) => [
                'id' => $v->id,
                'visit_number' => $visitNumbers[$v->id] ?? null,
                'visit_date' => $v->visit_date?->toDateString(),
                'zone_purok' => $v->zone_purok,
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
            ])->values(),
        ];
    }

    /** The mother as the register has her today. */
    private function person(Resident $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->full_name,
            'resident_number' => $r->resident_number,
            'birthdate' => $r->birthdate?->toDateString(),
            'age' => $r->birthdate?->age,
            'address' => $r->address,
            'zone_purok' => $r->zone_purok,
            'contact_number' => $r->contact_number,
            'deceased' => $r->isDeceased(),
        ];
    }
}
