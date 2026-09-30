<?php

namespace App\Services\Vawc;

use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Services\Population\Analytics;
use App\Support\ManilaTime;
use Carbon\Carbon;
use InvalidArgumentException;

/**
 * The VAW Desk's printed reports.
 *
 *   VAW-C Cases (quarterly, or the year's summary)
 *       one row per victim-survivor taken in: name, age, civil status,
 *       education, date of intake, address, kind of abuse, relationship to
 *       the perpetrator, the services extended, remarks. NAMES — so every
 *       case on it is written to its access trail each time it is drawn up.
 *
 *   VAW Form 1 — Barangay Data Capture Form
 *       counts only: the types of violence and the actions the barangay
 *       took. Each row is a case CODE, never a name — it is statistics for
 *       the DILG.
 *
 *   Barangay VAW Report — Annual Accomplishment Report
 *       the year in counts: the barangay's population, the cases received
 *       and acted upon, and a table of victims, referrals and BPOs by kind
 *       of case. No names and no case codes.
 *
 * A case belongs to the period its intake (report_date) falls in, in
 * Manila's calendar.
 */
final class DeskForms
{
    private const ORDINALS = [1 => '1ST', 2 => '2ND', 3 => '3RD', 4 => '4TH'];

    /**
     * "q3" → July to September; "m9" → September; "year" → the whole year.
     *
     * @return array{0: Carbon, 1: Carbon, 2: string, 3: string} from, to (UTC), period words, kind
     */
    public static function period(int $year, string $period): array
    {
        if ($period === 'year') {
            [$first, $last] = [1, 12];
        } elseif (preg_match('/^q([1-4])$/', $period, $m)) {
            $first = ((int) $m[1] - 1) * 3 + 1;
            $last = $first + 2;
        } elseif (preg_match('/^m(1[0-2]|[1-9])$/', $period, $m)) {
            $first = $last = (int) $m[1];
        } else {
            throw new InvalidArgumentException('Unknown period: ' . $period);
        }

        $from = Carbon::create($year, $first, 1, 0, 0, 0, ManilaTime::ZONE);
        $to = Carbon::create($year, $last, 1, 0, 0, 0, ManilaTime::ZONE)->endOfMonth();

        $words = $first === $last
            ? $from->format('F')
            : $from->format('F') . '–' . $to->format('F');

        return [$from->copy()->utc(), $to->copy()->utc(), $words, $period === 'year' ? 'year' : ($first === $last ? 'month' : 'quarter')];
    }

    /** The VAW-C Cases report. Writes one access-trail line per case on it. */
    public function casesReport(int $year, string $period): array
    {
        [$from, $to, $words, $kind] = self::period($year, $period);

        $heading = match ($kind) {
            'quarter' => 'Report for the ' . self::ORDINALS[(int) substr($period, 1)] . ' QUARTER ' . $year,
            'year' => 'Summary of VAW-C CASES',
            default => 'Report for the month of ' . mb_strtoupper($words) . ' ' . $year,
        };

        $rows = $this->casesIn($from, $to)->map(function (CaseFile $case) use ($heading, $year, $kind) {
            AccessLog::record($case->id, 'report_viewed', 'VAW-C cases report — ' . ($kind === 'year' ? "Summary {$year}" : $heading));

            $survivor = $case->survivor;
            $intake = $case->report_date?->copy()->setTimezone(ManilaTime::ZONE);

            return [
                'name' => $survivor?->full_name ?? '—',
                'age' => $survivor?->birthdate && $intake
                    ? (int) floor(Carbon::parse($survivor->birthdate)->diffInYears($intake->copy()->startOfDay(), true))
                    : null,
                'civil_status' => $survivor?->civil_status,
                'education' => $survivor?->educational_attainment,
                'date_intake' => $intake?->format('F j, Y'),
                'address' => trim(implode(', ', array_filter([$survivor?->address, $survivor?->zone_purok]))) ?: null,
                /* Every kind, spelled out — the summary form has one cell
                   for it, and "Mixed" tells the reader nothing. */
                'abuse' => self::abuseLabel($case),
                'relationship' => $case->relationship_to_offender ?: 'Not Recorded',
                'services' => $this->servicesOf($case),
                'remarks' => $case->status,
            ];
        })->values();

        return [
            'heading' => $heading,
            /* The year summary's own line: "From JANUARY – DECEMBER 2026". */
            'subheading' => $kind === 'year' ? 'From JANUARY – DECEMBER ' . $year : null,
            'rows' => $rows,
        ];
    }

    /** VAW Form 1 — case codes and ticks, no names. */
    public function dataCapture(int $year, string $period): array
    {
        [$from, $to, $words] = self::period($year, $period);

        $rows = $this->casesIn($from, $to)->map(function (CaseFile $case) {
            /*
             * EVERY KIND THE CASE IS, not just the first.
             *
             * These four cells used to be read off the one-word column, so
             * a case that was a beating AND threats AND wages withheld
             * ticked one box and left three blank — the barangay's own
             * quarterly return under-reporting three kinds of violence at
             * once. A case filed before the list existed still has its one
             * word, and is read from that.
             */
            $kinds = $case->violence_types ?: array_filter([$case->violence_type]);
            $issued = $case->protectionOrders->contains('status', 'Issued');
            $referredTo = $case->referrals->map(fn ($r) => self::referralColumn((string) $r->referral_agency))->unique();

            return [
                'code' => $case->case_code,
                'physical' => in_array('Physical', $kinds, true),
                'sexual' => in_array('Sexual', $kinds, true),
                /* A threat is psychological violence under RA 9262 §3(c). */
                'psychological' => (bool) array_intersect(['Threat', 'Psychological'], $kinds),
                'economic' => in_array('Economic', $kinds, true),
                'bpo' => $issued,
                'lswdo' => $referredTo->contains('lswdo'),
                'pnp' => $referredTo->contains('pnp'),
                'nbi' => $referredTo->contains('nbi'),
                'medical' => $referredTo->contains('medical'),
                'legal' => $referredTo->contains('legal'),
                'court' => $referredTo->contains('court'),
                'others' => $referredTo->contains('others'),
            ];
        })->values();

        $totals = ['victims' => $rows->count()];
        foreach (['physical', 'sexual', 'psychological', 'economic', 'bpo', 'lswdo', 'pnp', 'nbi', 'medical', 'legal', 'court', 'others'] as $key) {
            $totals[$key] = $rows->where($key, true)->count();
        }

        return [
            /* "July–September, 2026" — what goes on "For the period: ___". */
            'period' => $words . ', ' . $year,
            'rows' => $rows,
            'totals' => $totals,
        ];
    }

    /**
     * The Annual Accomplishment Report — counts only, for January to December.
     *
     * The table's rows are the paper's, each a kind of case; a case that is
     * two kinds is counted in both rows, as on the desk's other returns, so
     * the kinds need not add up to the first row, which is every case.
     *
     *   victims       different victim-survivors — one woman with two cases
     *                 is one victim, and one client served
     *   referred      cases sent to each office, a case counted once per
     *                 column however many letters went there
     *   applied_bpo   victims whose BPO was applied for (issued or refused
     *                 included — both were applied for first)
     *   bpo_issued    BPOs issued on those cases, each renewal its own BPO
     *
     * "Acted upon" is what the desk's response time counts as its first
     * action: a referral, a BPO applied for or issued, or a follow-up.
     *
     * Trafficking in Persons has no act of its own in a case file, so the
     * report cannot count it: its row is null — left blank to be written in
     * — rather than a zero the desk never counted.
     */
    public function annual(int $year): array
    {
        [$from, $to] = self::period($year, 'year');
        /* Nobody's name is on this report, so nobody's record is read for it. */
        $cases = $this->casesIn($from, $to, false)->loadCount('followups');

        $kinds = fn (CaseFile $c) => $c->violence_types ?: array_filter([$c->violence_type]);
        $acts = fn (CaseFile $c) => $c->violence_acts ?? [];

        $rows = [
            'ra9262' => $cases,
            'physical' => $cases->filter(fn ($c) => in_array('Physical', $kinds($c), true)),
            'sexual' => $cases->filter(fn ($c) => in_array('Sexual', $kinds($c), true)),
            /* A threat is psychological violence under RA 9262 §3(c). */
            'psychological' => $cases->filter(fn ($c) => (bool) array_intersect(['Threat', 'Psychological'], $kinds($c))),
            'economic' => $cases->filter(fn ($c) => in_array('Economic', $kinds($c), true)),
            'rape' => $cases->filter(fn ($c) => in_array('Rape', $acts($c), true)),
            'trafficking' => null,
            'sexual_harassment' => $cases->filter(fn ($c) => in_array('Sexual harassment', $acts($c), true)),
        ];

        $acted = $cases->filter(fn (CaseFile $c) => $c->referrals->isNotEmpty()
            || $c->followups_count > 0
            || $c->protectionOrders->contains(fn ($o) => $o->applied_on || $o->issued_on
                || in_array($o->status, ['Applied', 'Issued', 'Not Issued'], true)));

        return [
            'year' => $year,
            'population' => Analytics::headcount(),
            'clients_served' => self::victims($cases),
            'cases_received' => $cases->count(),
            'cases_acted_upon' => $acted->count(),
            'rows' => array_map(fn ($row) => $row === null ? null : self::annualRow($row), $rows),
        ];
    }

    /** One row of the annual table, from the cases that belong in it. */
    private static function annualRow($cases): array
    {
        $referred = ['cmswdo' => 0, 'pnp' => 0, 'court' => 0, 'hospital' => 0, 'others' => 0];

        foreach ($cases as $case) {
            /* VAW Form 1's eight destinations, on this form's five columns. */
            $columns = $case->referrals
                ->map(fn ($r) => match (self::referralColumn((string) $r->referral_agency)) {
                    'lswdo' => 'cmswdo',
                    'pnp' => 'pnp',
                    'court' => 'court',
                    'medical' => 'hospital',
                    default => 'others',
                })
                ->unique();

            foreach ($columns as $column) {
                $referred[$column]++;
            }
        }

        $applied = $cases->filter(fn (CaseFile $c) => $c->protectionOrders->contains(
            fn ($o) => $o->applied_on || in_array($o->status, ['Applied', 'Issued', 'Not Issued'], true)
        ));

        return [
            'victims' => self::victims($cases),
            'referred' => $referred,
            'applied_bpo' => self::victims($applied),
            'bpo_issued' => $cases->sum(fn (CaseFile $c) => $c->protectionOrders->where('status', 'Issued')->count()),
        ];
    }

    /** Different victim-survivors; a case with nobody linked is one of its own. */
    private static function victims($cases): int
    {
        return $cases->map(fn (CaseFile $c) => $c->survivor_id ? 'r' . $c->survivor_id : 'c' . $c->id)->unique()->count();
    }

    private function casesIn(Carbon $from, Carbon $to, bool $withSurvivor = true)
    {
        return CaseFile::with(array_filter([
            $withSurvivor ? 'survivor:id,first_name,middle_name,last_name,suffix,birthdate,civil_status,educational_attainment,address,zone_purok' : null,
            'referrals:id,vawc_case_id,referral_agency',
            'protectionOrders:id,vawc_case_id,status,applied_on,issued_on',
            'assessment:id,vawc_case_id,services_provided',
        ]))
            ->where('status', '!=', 'Archived')
            ->whereBetween('report_date', [$from, $to])
            ->orderBy('report_date')
            ->orderBy('id')
            ->get();
    }

    /** What the desk did for her, in a few words. */
    private function servicesOf(CaseFile $case): string
    {
        $services = [];

        $orders = $case->protectionOrders;
        if ($orders->contains('status', 'Issued')) {
            $services[] = 'BPO issued';
        } elseif ($orders->whereIn('status', ['Applied', 'Application Prepared'])->isNotEmpty()) {
            $services[] = 'BPO applied for';
        }

        foreach ($case->referrals as $referral) {
            $services[] = 'Referred to ' . $referral->referral_agency;
        }

        foreach ($case->assessment?->services_provided ?? [] as $service) {
            /* The referrals and the BPO are already named above. */
            if (! str_contains($service, 'referral') && $service !== 'BPO assistance' && $service !== 'Other') {
                $services[] = $service;
            }
        }

        return implode('; ', array_unique($services));
    }

    public static function abuseLabel(CaseFile $case): ?string
    {
        /* A case filed before the list existed still says one word. */
        $kinds = $case->violence_types ?: array_filter([$case->violence_type]);

        if ($kinds === []) {
            return null;
        }

        /* The office's own headings: three are "Violence", the fourth is
           "Abuse", which is what RA 9262 and the form both call it. */
        return implode(', ', array_map(fn (string $kind) => match ($kind) {
            'Economic' => 'Economic Abuse',
            'Threat' => 'Threat',
            default => $kind . ' Violence',
        }, $kinds));
    }

    /** Which "referred to" column of VAW Form 1 a destination belongs in. */
    public static function referralColumn(string $agency): string
    {
        $a = strtolower($agency);

        return match (true) {
            str_contains($a, 'mswdo'), str_contains($a, 'cswdo'), str_contains($a, 'lswdo') => 'lswdo',
            str_contains($a, 'pnp'), str_contains($a, 'police') => 'pnp',
            (bool) preg_match('/\bnbi\b/', $a) => 'nbi',
            str_contains($a, 'hospital'), str_contains($a, 'health'), str_contains($a, 'medical') => 'medical',
            (bool) preg_match('/\bpao\b/', $a), str_contains($a, 'legal'), str_contains($a, 'attorney') => 'legal',
            str_contains($a, 'court') => 'court',
            default => 'others',
        };
    }
}
