<?php

namespace App\Services\Health;

use App\Models\Health\ChildRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * The station's monthly and yearly reports — Child Health & Nutrition,
 * Maternal Health, and Prenatal Records — counted from the records and
 * nothing else.
 *
 * ONE SHAPE FOR EVERY USE. The page, the printed copy, the CSV and the
 * Excel file are all this array, so an export cannot say something the
 * screen does not.
 *
 * THE DATE IS THE RECORD'S OWN: the weighing's record_date, the
 * pregnancy's registration date, the prenatal visit's date — never the day
 * somebody typed it in. A month is its first to its last day; a year is
 * every one of its twelve months, the empty ones included, as 0.
 *
 * DESCRIPTIVE ONLY. Counts by zone, by the nutritional status the health
 * worker chose, by age in five-year bands. Nothing is judged, graded or
 * flagged.
 */
final class HealthReports
{
    public const KINDS = ['child', 'maternal', 'prenatal'];

    private const TITLES = [
        'child' => 'Child Health & Nutrition',
        'maternal' => 'Maternal Health',
        'prenatal' => 'Prenatal Records',
    ];

    private const NOT_RECORDED = 'Not recorded';

    public function __construct(
        private readonly ParentLinks $parents,
        private readonly PregnancyRegister $register,
    ) {
    }

    /**
     * @param 'child'|'maternal'|'prenatal' $kind
     * @param int|null $month null for the yearly report
     */
    public function build(string $kind, int $year, ?int $month, ?string $zone): array
    {
        $monthly = $month !== null;
        $from = Carbon::create($year, $month ?? 1, 1)->startOfDay();
        $to = $monthly ? $from->copy()->endOfMonth() : $from->copy()->endOfYear();

        $report = [
            'kind' => $kind,
            'period' => $monthly ? 'monthly' : 'yearly',
            'title' => self::TITLES[$kind] . ($monthly ? ' Monthly Report' : ' Annual Report'),
            'barangay' => 'Barangay Natumolan',
            'year' => $year,
            'month' => $month,
            'period_label' => $monthly ? $from->format('F Y') : (string) $year,
            'zone_purok' => $zone,
            'zone_label' => $zone ?: 'All zones',
            'generated_at' => ManilaTime::now(),
            'range' => [$from->toDateString(), $to->toDateString()],
        ];

        return $report + match ($kind) {
            'child' => $this->child($from, $to, $zone, $monthly),
            'maternal' => $this->maternal($from, $to, $zone, $monthly),
            'prenatal' => $this->prenatal($from, $to, $zone, $monthly),
        };
    }

    /**
     * The whole report as rows of cells — what CSV and Excel write.
     *
     * @return list<list<string|int|float|null>>
     */
    public function sheet(array $r): array
    {
        $rows = [
            [$r['title']],
            [$r['barangay']],
            [$r['period'] === 'monthly' ? 'Month' : 'Year', $r['period_label']],
            ['Zone', $r['zone_label']],
            ['Generated', Carbon::parse($r['generated_at'])->format('F j, Y g:i A')],
            [],
        ];

        if ($r['period'] === 'monthly') {
            $rows[] = array_column($r['columns'], 'label');
            foreach ($r['rows'] as $line) {
                $rows[] = array_map(fn ($c) => $line[$c['key']] ?? null, $r['columns']);
            }
            if (! $r['rows']) {
                $rows[] = ['No records found for the selected period.'];
            }
        } else {
            $rows[] = ['Month', 'Records'];
            foreach ($r['months'] as $m) {
                $rows[] = [$m['label'], $m['total']];
            }
        }
        $rows[] = ['TOTAL', $r['total']];

        foreach ($r['summaries'] as $summary) {
            $rows[] = [];
            $rows[] = [$summary['title']];
            $rows[] = [$summary['label'], 'Records'];
            foreach ($summary['rows'] as $s) {
                $rows[] = [$s['label'], $s['total']];
            }
        }

        return $rows;
    }

    /* ------------------------------------------------------------------ */

    private function child(Carbon $from, Carbon $to, ?string $zone, bool $monthly): array
    {
        $query = fn () => ChildRecord::query()
            ->join('residents as c', 'c.id', '=', 'child_health.child_id')
            ->whereBetween('child_health.record_date', [$from->toDateString(), $to->toDateString()])
            ->when($zone, fn ($q) => $q->where('c.zone_purok', $zone));

        $total = $query()->count();

        $summaries = [
            $this->summary('By nutritional status', 'Nutritional status',
                $query()->selectRaw('child_health.nutritional_status as label, count(*) as total')
                    ->groupBy('child_health.nutritional_status')->pluck('total', 'label'),
                ChildRecord::NUTRITIONAL_STATUSES),
            $this->summary('By zone', 'Zone',
                $query()->selectRaw('c.zone_purok as label, count(*) as total')->groupBy('c.zone_purok')->pluck('total', 'label')),
        ];

        $out = ['total' => $total, 'summaries' => $summaries];

        if ($monthly) {
            $records = $query()->select('child_health.*')
                ->with('child')
                ->orderBy('child_health.record_date')->orderBy('child_health.id')
                ->get();

            $out['columns'] = $this->columns([
                'record_date' => 'Date', 'child_name' => 'Child', 'birth_date' => 'Birthdate', 'sex' => 'Sex',
                'zone_purok' => 'Zone / Purok', 'weight' => 'Weight (kg)', 'height' => 'Height (cm)',
                'nutritional_status' => 'Nutritional Status', 'mother' => 'Mother', 'father' => 'Father',
            ]);
            $out['rows'] = $records->map(function (ChildRecord $r) {
                $parents = $this->parents->registerParents($r->child);

                return [
                    'record_date' => $r->record_date?->toDateString(),
                    'child_name' => $r->child->full_name,
                    'birth_date' => $r->child->birthdate?->toDateString(),
                    'sex' => in_array($r->child->gender, ['Male', 'Female'], true) ? $r->child->gender : null,
                    'zone_purok' => $r->child->zone_purok,
                    'weight' => $this->number($r->current_weight),
                    'height' => $this->number($r->current_height),
                    'nutritional_status' => $r->nutritional_status,
                    'mother' => $parents['mother']?->full_name,
                    'father' => $parents['father']?->full_name,
                ];
            })->values()->all();
        } else {
            $out['months'] = $this->months($from->year,
                $query()->selectRaw('MONTH(child_health.record_date) as m, count(*) as total')->groupBy('m')->pluck('total', 'm'));
        }

        return $out;
    }

    private function maternal(Carbon $from, Carbon $to, ?string $zone, bool $monthly): array
    {
        $query = fn () => MaternalRecord::query()
            ->join('residents as m', 'm.id', '=', 'maternal_health.mother_id')
            ->whereBetween('pregnancy_registration_date', [$from->toDateString(), $to->toDateString()])
            ->when($zone, fn ($q) => $q->where('m.zone_purok', $zone));

        $total = $query()->count();

        /* Her age when the pregnancy was registered, from her birth date. */
        $ages = $query()->get(['m.birthdate', 'maternal_health.pregnancy_registration_date'])
            ->map(fn ($row) => $row->birthdate
                ? Carbon::parse($row->birthdate)->diff(Carbon::parse($row->pregnancy_registration_date))->y
                : null);
        $summaries = [
            $this->summary('By zone', 'Zone',
                $query()->selectRaw('m.zone_purok as label, count(*) as total')->groupBy('m.zone_purok')->pluck('total', 'label')),
            $this->summary('By age group', 'Age group', $this->ageBands($ages), array_keys($this->ageBandTemplate())),
            $this->summary('By status', 'Status',
                $query()->selectRaw('maternal_health.status as label, count(*) as total')->groupBy('maternal_health.status')->pluck('total', 'label'),
                [MaternalRecord::ACTIVE, MaternalRecord::DELIVERED, MaternalRecord::CLOSED]),
        ];

        $out = ['total' => $total, 'summaries' => $summaries];

        if ($monthly) {
            $records = $query()->select('maternal_health.*')->with('mother')->withCount('prenatalVisits')
                ->orderBy('pregnancy_registration_date')->orderBy('maternal_health.id')->get();
            $numbers = $this->register->numbers($records);

            $out['columns'] = $this->columns([
                'registered' => 'Date Registered', 'mother' => 'Mother', 'resident_number' => 'Resident Number',
                'age' => 'Age', 'zone_purok' => 'Zone / Purok', 'contact_number' => 'Contact Number', 'lmp' => 'LMP',
                'edc' => 'EDC', 'pregnancy_number' => 'Pregnancy Number', 'prenatal_visits' => 'Prenatal Visits',
                'status' => 'Status',
            ]);
            $out['rows'] = $records->map(fn (MaternalRecord $p) => [
                'registered' => $p->pregnancy_registration_date?->toDateString(),
                'mother' => $p->motherDisplayName(),
                'resident_number' => $p->mother?->resident_number,
                'age' => $p->mother?->birthdate ? $p->mother->birthdate->diff($p->pregnancy_registration_date)->y : null,
                'zone_purok' => $p->mother?->zone_purok,
                'contact_number' => $p->mother?->contact_number,
                'lmp' => $p->lmp?->toDateString(),
                'edc' => $p->expected_delivery_date?->toDateString(),
                'pregnancy_number' => $numbers[$p->id] ?? 1,
                'prenatal_visits' => (int) $p->prenatal_visits_count,
                'status' => $p->status,
            ])->values()->all();
        } else {
            $out['months'] = $this->months($from->year,
                $query()->selectRaw('MONTH(pregnancy_registration_date) as mo, count(*) as total')->groupBy('mo')->pluck('total', 'mo'));
        }

        return $out;
    }

    private function prenatal(Carbon $from, Carbon $to, ?string $zone, bool $monthly): array
    {
        $query = fn () => PrenatalVisit::query()
            ->whereBetween('visit_date', [$from->toDateString(), $to->toDateString()])
            ->when($zone, fn ($q) => $q->where('zone_purok', $zone));

        $total = $query()->count();

        $summaries = [
            $this->summary('By zone', 'Zone',
                $query()->selectRaw('zone_purok as label, count(*) as total')->groupBy('zone_purok')->pluck('total', 'label')),
        ];

        $out = ['total' => $total, 'summaries' => $summaries];

        if ($monthly) {
            $records = $query()->with(['pregnancy', 'mother:id,resident_number'])
                ->orderBy('visit_date')->orderBy('id')->get();
            $pregnancies = $records->pluck('pregnancy')->unique('id')->values();
            $pregnancyNumbers = $this->register->numbers($pregnancies);
            $visitNumbers = $this->register->visitNumbers($pregnancies->pluck('id')->all());

            $out['columns'] = $this->columns([
                'visit_date' => 'Date', 'zone_purok' => 'Zone / Purok', 'mother' => 'Mother', 'age' => 'Age',
                'weight' => 'WT (kg)', 'blood_pressure' => 'BP', 'height' => 'HT (cm)', 'lmp' => 'LMP',
                'edc' => 'EDC', 'mos' => 'MOS', 'contact_number' => 'Contact Number',
                'pregnancy_number' => 'Pregnancy Number', 'visit_number' => 'Prenatal Visit Number',
            ]);
            $out['rows'] = $records->map(fn (PrenatalVisit $v) => [
                'visit_date' => $v->visit_date?->toDateString(),
                'zone_purok' => $v->zone_purok,
                'mother' => $v->pregnancy->motherDisplayName(),
                'age' => $v->age,
                'weight' => $this->number($v->weight_kg),
                'blood_pressure' => $v->blood_pressure,
                'height' => $this->number($v->height_cm),
                'lmp' => $v->lmp?->toDateString(),
                'edc' => $v->edc?->toDateString(),
                'mos' => $v->months_of_pregnancy,
                'contact_number' => $v->contact_number,
                'pregnancy_number' => $pregnancyNumbers[$v->pregnancy_id] ?? 1,
                'visit_number' => $visitNumbers[$v->id] ?? null,
            ])->values()->all();
        } else {
            $out['months'] = $this->months($from->year,
                $query()->selectRaw('MONTH(visit_date) as m, count(*) as total')->groupBy('m')->pluck('total', 'm'));
        }

        return $out;
    }

    /* ------------------------------------------------------------------ */

    /** Every month of the year, in order, with 0 for the empty ones. */
    private function months(int $year, Collection $counts): array
    {
        return collect(range(1, 12))->map(fn (int $m) => [
            'month' => $m,
            'label' => Carbon::create($year, $m, 1)->format('F'),
            'total' => (int) ($counts[$m] ?? 0),
        ])->all();
    }

    /**
     * A count table. `$order` lists the labels always shown — the
     * configured options, 0 where nothing was recorded; other values
     * follow; blanks come last as "Not recorded".
     */
    private function summary(string $title, string $label, Collection $counts, array $order = []): array
    {
        $rows = [];
        $blank = 0;
        foreach ($counts as $key => $n) {
            if ($key === null || $key === '') {
                $blank += (int) $n;
            }
        }

        foreach ($order as $key) {
            $rows[] = ['label' => $key, 'total' => (int) ($counts[$key] ?? 0)];
        }

        $others = $counts->filter(fn ($n, $key) => $key !== null && $key !== '' && ! in_array($key, $order, true));
        foreach ($others->sortKeysUsing(fn ($a, $b) => strnatcasecmp((string) $a, (string) $b)) as $key => $n) {
            $rows[] = ['label' => (string) $key, 'total' => (int) $n];
        }

        if ($blank > 0 && ! in_array(self::NOT_RECORDED, $order, true)) {
            $rows[] = ['label' => self::NOT_RECORDED, 'total' => $blank];
        }

        return ['title' => $title, 'label' => $label, 'rows' => $rows];
    }

    /** Ages in five-year bands. A band is a count, not a judgement. */
    private function ageBands(Collection $ages): Collection
    {
        $bands = $this->ageBandTemplate();
        foreach ($ages as $age) {
            $bands[$this->band($age)]++;
        }

        return collect($bands);
    }

    private function ageBandTemplate(): array
    {
        return ['19 and under' => 0, '20–24' => 0, '25–29' => 0, '30–34' => 0, '35–39' => 0,
            '40 and over' => 0, self::NOT_RECORDED => 0];
    }

    private function band(?int $age): string
    {
        return match (true) {
            $age === null => self::NOT_RECORDED,
            $age <= 19 => '19 and under',
            $age <= 24 => '20–24',
            $age <= 29 => '25–29',
            $age <= 34 => '30–34',
            $age <= 39 => '35–39',
            default => '40 and over',
        };
    }

    private function columns(array $map): array
    {
        return collect($map)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all();
    }

    /** "57.80" → 57.8: the number as it was written, without the padding the column adds. */
    private function number($value): int|float|null
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (float) $value == (int) $value ? (int) $value : (float) $value;
    }
}
