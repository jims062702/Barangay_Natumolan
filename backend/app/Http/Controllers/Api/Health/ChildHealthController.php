<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ChildRecord;
use App\Models\Resident\Resident;
use App\Services\Health\ParentLinks;
use App\Services\Health\RegisteredPerson;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Child Health & Nutrition — every weighing kept, for children on the
 * Population Office's register.
 *
 * THE MOTHER COMES FIRST. The station finds the mother; the register says
 * which children are hers (resident_parents, parent_role Mother) and who
 * each one's father is. The station picks the child — or the twins — and
 * records the weighing. It never types who a child is, and it cannot record
 * a child the register does not list: a child is registered, and linked to
 * the mother, by the Population Office first.
 *
 * A RECORD is one weighing of one child: its date (the day it is recorded,
 * set here), the weight, the height, and the nutritional status the health
 * worker chose. A child's history is all of them; adding one never replaces
 * another.
 */
class ChildHealthController extends BaseController
{
    public function __construct(
        private readonly ParentLinks $parents,
        private readonly RegisteredPerson $people,
    ) {
    }

    /** Records, newest first — searchable by child, resident number, mother or zone. */
    public function index(Request $request)
    {
        $query = ChildRecord::query()
            ->select('child_health.*')
            ->join('residents as c', 'c.id', '=', 'child_health.child_id')
            ->with('child')
            ->when($request->filled('zone_purok'), fn ($q) => $q->where('c.zone_purok', $request->zone_purok))
            ->when($request->filled('year'), fn ($q) => $q->whereYear('child_health.record_date', (int) $request->year))
            ->when($request->filled('month'), fn ($q) => $q->whereMonth('child_health.record_date', (int) $request->month))
            ->when($request->filled('search'), fn ($q) => $this->search($q, trim((string) $request->search)))
            ->orderByDesc('child_health.record_date')
            ->orderByDesc('child_health.id');

        $page = $query->paginate(20);
        $page->getCollection()->transform(fn (ChildRecord $r) => $this->row($r));

        return $this->success($page, 'Child health records retrieved');
    }

    /**
     * A mother, as the form needs her: her details from the register, and
     * the children the register lists her as the mother of — each with the
     * father the register names for them.
     */
    public function mother(Resident $resident)
    {
        $mother = $this->people->woman($resident->id);
        $children = $this->parents->childrenOf($mother);

        $counts = ChildRecord::whereIn('child_id', $children->pluck('child.id'))
            ->groupBy('child_id')
            ->selectRaw('child_id, count(*) as records, max(record_date) as last_record')
            ->get()
            ->keyBy('child_id');

        return $this->success([
            'mother' => $this->parents->person($mother),
            'children' => $children->map(fn ($c) => $this->parents->person($c['child']) + [
                'father' => $this->parents->person($c['father']),
                'records' => (int) ($counts->get($c['child']->id)->records ?? 0),
                'last_record' => $counts->get($c['child']->id)->last_record ?? null,
            ])->values(),
        ], 'Mother found');
    }

    /** One child: who they are and who their parents are (the register), and every weighing. */
    public function child(Resident $resident)
    {
        $register = $this->parents->registerParents($resident);
        $records = ChildRecord::where('child_id', $resident->id)
            ->orderByDesc('record_date')->orderByDesc('id')
            ->get();

        $mother = $register['mother'];
        $father = $register['father'];

        return $this->success([
            'child' => $this->parents->person($resident),
            'mother' => $this->parents->person($mother),
            'father' => $this->parents->person($father),
            /* Yes when the register has the two married to each other, No
               when it has them both and they are not; otherwise not said. */
            'father_is_current_spouse' => ($mother && $father) ? (int) $mother->spouse_id === (int) $father->id : null,
            'records' => $records->map(fn (ChildRecord $r) => $this->measurement($r))->values(),
        ], 'Child health history retrieved');
    }

    /**
     * New weighings — one per child chosen, every one its own record.
     *
     * Each child must be one the register lists as this mother's. The date
     * is today's, in Manila, set here — or, for a record the office saved
     * with the line down and is only now sending, the day it was saved on
     * (never later than today, never more than a month back).
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'mother_id' => 'required|integer',
            'recorded_on' => 'nullable|date',
            'records' => 'required|array|min:1|max:12',
            'records.*.child_id' => 'required|integer|distinct',
            'records.*.current_weight' => 'required|numeric|between:0.3,80',
            'records.*.current_height' => 'required|numeric|between:20,200',
            'records.*.nutritional_status' => ['required', Rule::in(ChildRecord::NUTRITIONAL_STATUSES)],
        ], [
            'records.required' => 'Choose at least one child.',
            'records.*.current_weight.required' => 'Enter the weight.',
            'records.*.current_height.required' => 'Enter the height.',
            'records.*.nutritional_status.required' => 'Choose the nutritional status.',
            'records.*.current_weight.between' => 'Check the weight (kg).',
            'records.*.current_height.between' => 'Check the height (cm).',
            'records.*.child_id.distinct' => 'A child was chosen twice.',
        ]);

        $mother = $this->people->woman($data['mother_id']);
        $date = $this->recordDate($data['recorded_on'] ?? null);

        foreach ($data['records'] as $i => $line) {
            $child = Resident::whereNull('merged_into_id')->find($line['child_id']);
            if (! $child || ! $this->parents->isMotherOf($mother->id, $child->id)) {
                throw ValidationException::withMessages([
                    "records.$i.child_id" => 'That child is not listed as '
                        . "{$mother->full_name}'s child on the register. The Population Office registers the child "
                        . 'and links them to their mother first.',
                ]);
            }
        }

        $saved = DB::transaction(function () use ($data, $date) {
            return collect($data['records'])->map(function (array $line) use ($date) {
                $fields = [
                    'current_weight' => $line['current_weight'],
                    'current_height' => $line['current_height'],
                    'nutritional_status' => $line['nutritional_status'],
                ];

                /* The same weighing sent twice — a double press, a slow
                   line — is one record, not two. */
                $again = ChildRecord::where('child_id', $line['child_id'])
                    ->whereDate('record_date', $date)
                    ->where($fields)
                    ->where('created_at', '>=', now()->subMinutes(2))
                    ->first();
                if ($again) {
                    return $again;
                }

                $child = Resident::find($line['child_id']);

                return ChildRecord::create($fields + [
                    'child_id' => $child->id,
                    'record_date' => $date,
                    'birth_date' => $child->birthdate?->toDateString() ?? $date,
                    'created_by' => auth()->id(),
                ]);
            });
        });

        return $this->success($saved->map(fn (ChildRecord $r) => $this->row($r->fresh('child')))->values(),
            $saved->count() === 1 ? 'Child health record saved' : "{$saved->count()} child health records saved", 201);
    }

    /** Correcting a weighing. It stays the same record, on the same day — no second one is made. */
    public function update(Request $request, ChildRecord $record)
    {
        $data = $request->validate([
            'current_weight' => 'required|numeric|between:0.3,80',
            'current_height' => 'required|numeric|between:20,200',
            'nutritional_status' => ['required', Rule::in(ChildRecord::NUTRITIONAL_STATUSES)],
        ]);
        $record->update($data + ['updated_by' => auth()->id()]);

        return $this->success($this->row($record->fresh('child')), 'Child health record updated');
    }

    /** A weighing entered in error. The child's other records are untouched. */
    public function destroy(ChildRecord $record)
    {
        $record->delete();

        return $this->success(null, 'Child health record deleted');
    }

    /* ------------------------------------------------------------------ */

    private function recordDate(?string $recordedOn): string
    {
        $today = ManilaTime::today();
        if (! $recordedOn) {
            return $today;
        }

        $day = Carbon::parse($recordedOn)->toDateString();

        return ($day > $today || $day < Carbon::parse($today)->subDays(30)->toDateString()) ? $today : $day;
    }

    private function search(Builder $q, string $term): void
    {
        $like = '%' . $term . '%';
        $q->where(function ($w) use ($like) {
            $w->whereRaw("CONCAT_WS(' ', c.first_name, c.middle_name, c.last_name) LIKE ?", [$like])
                ->orWhere('c.resident_number', 'like', $like)
                ->orWhere('c.zone_purok', 'like', $like)
                /* The register's mother of the child. */
                ->orWhereExists(fn ($e) => $e->select(DB::raw(1))
                    ->from('resident_parents as rp')
                    ->join('residents as m', 'm.id', '=', 'rp.parent_id')
                    ->whereColumn('rp.child_id', 'c.id')
                    ->where('rp.parent_role', 'Mother')
                    ->whereRaw("CONCAT_WS(' ', m.first_name, m.middle_name, m.last_name) LIKE ?", [$like]));
        });
    }

    private function measurement(ChildRecord $r): array
    {
        return [
            'id' => $r->id,
            'record_date' => $r->record_date?->toDateString(),
            'current_weight' => $r->current_weight,
            'current_height' => $r->current_height,
            'nutritional_status' => $r->nutritional_status,
            /* The version an edit is typed against — see useModalDraft. */
            'version' => $r->updated_at?->toIso8601String(),
        ];
    }

    /** One line of the list: the weighing, the child and the parents — the last two from the register. */
    private function row(ChildRecord $r): array
    {
        $child = $r->child;
        $parents = $this->parents->registerParents($child);

        return $this->measurement($r) + [
            'child_id' => $child->id,
            'child_name' => $child->full_name,
            'child_resident_number' => $child->resident_number,
            'birth_date' => $child->birthdate?->toDateString(),
            'sex' => in_array($child->gender, ['Male', 'Female'], true) ? $child->gender : null,
            'zone_purok' => $child->zone_purok,
            'mother_name' => $parents['mother']?->full_name,
            'father_name' => $parents['father']?->full_name,
        ];
    }
}
