<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\AnimalBiteReferral;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\PrenatalVisit;
use App\Models\Health\SeniorCheck;
use App\Models\Health\Visit;
use App\Models\Lupon\CaseFile as LuponCase;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Payment;
use App\Models\Population\Zone;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Vawc\CaseFile as VawcCase;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * One report across three desks, for the officers who answer for all of them.
 *
 * The Secretary writes the barangay's reports and the Punong Barangay signs
 * them, and both were doing it by opening three screens and copying figures
 * onto paper — which is where a transcription error becomes a submitted
 * return.
 *
 * WHAT THE VAWC SECTION CONTAINS, AND WHAT IT NEVER WILL. Counts. How many
 * cases were opened, how many are open now, nothing else. No name, no case
 * code, no address, no kind of violence against a person — the desk's own
 * screens are the only place those exist, and they are reachable only by the
 * VAWC office. A consolidated report is read aloud in session and filed where
 * others can see it; a survivor's case must not travel in it.
 *
 * The Lupon and Health sections are ordinary barangay statistics and carry
 * the detail a report actually needs.
 */
class ConsolidatedReportController extends BaseController
{
    /**
     * The whole barangay, office by office — for the two who answer for it.
     *
     * The Secretary writes the barangay's return and the Punong Barangay
     * signs it. It is the ONE report that gathers every office's figures, so
     * it carries all five sections, and it is theirs alone: a desk's own
     * figures are its own report (office() below), not a slice of this one.
     */
    private const SECTIONS = ['lupon', 'vawc', 'health', 'population', 'certificates'];

    private const CONSOLIDATED_OFFICES = ['Main Office', 'PB'];

    /**
     * The offices whose OWN report is built here.
     *
     * Health and Population had no report page of their own. Lupon (Reports
     * & Archives), VAWC (Reports) and the Clerk (Certificate Report) each
     * already keep one, so they are not given a second.
     */
    private const OWN_SECTION = [
        'Health Station' => 'health',
        'Population' => 'population',
    ];

    /** The consolidated return: every office, Secretary and PB only. */
    public function show(Request $request)
    {
        /* The Clerk sits in the Main Office too. The route turns them away by
           role; this says it again here, so the rule does not depend on
           every route that ever reaches this method remembering it. */
        $user = $request->user();

        if (! in_array($user?->office, self::CONSOLIDATED_OFFICES, true) || $user?->role === 'Clerk') {
            return $this->error(
                'The consolidated report is kept by the Secretary and the Punong Barangay. '
                    . 'Your office has its own report.',
                403
            );
        }

        return $this->success(
            $this->build($request, self::SECTIONS),
            'Consolidated report retrieved'
        );
    }

    /** One office's own report — the same figures the consolidated one uses. */
    public function office(Request $request)
    {
        $section = self::OWN_SECTION[$request->user()?->office] ?? null;

        if (! $section) {
            return $this->error('This office keeps its report elsewhere.', 403);
        }

        return $this->success($this->build($request, [$section]), 'Office report retrieved');
    }

    /**
     * The sections asked for, over one period.
     *
     * Built by the same methods for both doors, so the Health Station's own
     * report and the Health section of the consolidated return can never
     * disagree about the same month.
     */
    private function build(Request $request, array $sections): array
    {
        [$from, $to, $label] = $this->window($request);

        $report = [
            'period' => ['from' => $from, 'to' => $to, 'label' => $label],
            'sections' => $sections,
        ];

        foreach ($sections as $section) {
            $report[$section] = match ($section) {
                'lupon' => $this->lupon($from, $to),
                'vawc' => $this->vawc($from, $to),
                'health' => $this->health($from, $to),
                'population' => $this->population($from, $to, $this->zoneAsked($request)),
                'certificates' => $this->certificates($from, $to),
            };
        }

        return $report;
    }

    /**
     * The stretch of time being reported on.
     *
     * Defaults to the current month, which is what a barangay reports on.
     * Manila's clock, not the server's — see ManilaTime.
     */
    private function window(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $today = ManilaTime::today();
        $from = $validated['from'] ?? date('Y-m-01', strtotime($today));
        $to = $validated['to'] ?? $today;

        return [$from, $to, date('F Y', strtotime($from))];
    }

    private function lupon(string $from, string $to): array
    {
        $filed = LuponCase::whereBetween('date_filed', [$from, $to]);

        $hearings = Hearing::whereBetween('scheduled_at', [$from . ' 00:00:00', $to . ' 23:59:59']);

        $paid = Payment::where('status', 'Paid')
            ->whereBetween('paid_at', [$from . ' 00:00:00', $to . ' 23:59:59']);

        return [
            'filed' => (clone $filed)->count(),
            /*
             * A PLAIN query, not the model.
             *
             * Through Eloquent these grouped rows came back carrying the
             * model's appended person accessors — complainant_display_name,
             * complainant_display_address — all null, because a count row has
             * no complainant. Null or not, a report meant to be filed and
             * shared should not have person-shaped keys in it at all.
             */
            'by_classification' => DB::table('lupon_cases')
                ->whereBetween('date_filed', [$from, $to])
                ->selectRaw('case_classification as label, count(*) as total')
                ->groupBy('case_classification')
                ->orderByDesc('total')
                ->get(),
            'settled' => LuponCase::where('current_stage', 'Settled')
                ->whereBetween('date_resolved', [$from, $to])->count(),
            'open_now' => LuponCase::whereNotIn(
                'current_stage',
                ['Settled', 'Dismissed', 'Referred']
            )->count(),
            /* Referred out — to the VAWC desk, or to a barangay that has
               jurisdiction. Not a Certificate to File Action: this Lupon
               issues none, and the figure that counted them is gone. */
            'referred_out' => LuponCase::where('current_stage', 'Referred')
                ->whereBetween('date_resolved', [$from, $to])->count(),
            'hearings_held' => (clone $hearings)->where('status', 'Completed')->count(),
            'hearings_scheduled' => (clone $hearings)->where('status', 'Scheduled')->count(),
            /* How many complainants have settled their filing fee — a
               COUNT, not a sum. The barangay keeps its own book of the
               money; this system never touched a peso of it. */
            'fees_settled' => (clone $paid)->count(),
        ];
    }

    /**
     * VAWC, as numbers and nothing else.
     *
     * Deliberately the shortest section here. Every figure is a count over
     * the whole desk; not one of them can be traced to a person.
     */
    private function vawc(string $from, string $to): array
    {
        return [
            'opened' => VawcCase::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
                ->count(),
            'open_now' => VawcCase::where('status', 'Active')->count(),
            'note' => 'Counts only. Case details are held at the VAWC Desk and are not '
                . 'included in any consolidated report.',
        ];
    }

    /**
     * The station's registers over the period: consultations, doses given,
     * the two day-lists, and the animal-bite referrals.
     *
     * Doses are counted by the day they were GIVEN, not the day somebody
     * typed them in — a card filled in on Monday for last Friday's clinic
     * belongs to last Friday.
     */
    private function health(string $from, string $to): array
    {
        return [
            'visits' => Visit::whereBetween('visit_date', [$from, $to])->count(),
            'doses_given' => ImmunizationRecord::whereBetween('vaccination_date', [$from, $to])->count(),
            /* Plain query, for the same reason as the Lupon's grouped rows:
               a count row should not carry a person-shaped key. */
            'doses_by_vaccine' => DB::table('immunization_records')
                ->whereBetween('vaccination_date', [$from, $to])
                ->selectRaw('vaccine_name as label, count(*) as total')
                ->groupBy('vaccine_name')
                ->orderByDesc('total')
                ->get(),
            'prenatal_visits' => PrenatalVisit::whereBetween('visit_date', [$from, $to])->count(),
            /* By the day the pregnancy was registered at the station, not
               the day somebody typed it in. */
            'pregnancies_registered' => MaternalRecord::whereBetween('pregnancy_registration_date', [$from, $to])->count(),
            'senior_checks' => SeniorCheck::whereBetween('check_date', [$from, $to])->count(),
            'animal_bites_referred' => AnimalBiteReferral::whereBetween('referred_on', [$from, $to])->count(),
        ];
    }

    /**
     * Who lives here, as the register stands, and who was added this period.
     *
     * The living, resident population only: a non-resident is on the
     * register so a family could be recorded whole, and a death recorded is
     * a person the barangay no longer counts.
     */
    /**
     * The zone the Population Office narrowed its report to, if any — and
     * only a zone the barangay actually has, so a typed-in name cannot
     * produce a report of nobody that looks like a real one.
     */
    private function zoneAsked(Request $request): ?string
    {
        $zone = trim((string) $request->input('zone'));

        return $zone !== '' && Zone::where('name', $zone)->exists() ? $zone : null;
    }

    private function population(string $from, string $to, ?string $zone = null): array
    {
        /* One zone, when the office asked for one — every figure below
           follows it, so the printed report is that zone's alone. */
        $living = fn () => Resident::where('record_type', 'Resident')
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('life_status')->orWhere('life_status', '!=', 'Deceased'))
            ->when($zone, fn ($q) => $q->where('zone_purok', $zone));

        $today = ManilaTime::today();
        $ageBand = fn (int $min, ?int $max) => $living()
            ->whereNotNull('birthdate')
            ->where('birthdate', '<=', date('Y-m-d', strtotime("$today -$min years")))
            ->when($max !== null, fn ($q) => $q->where(
                'birthdate',
                '>',
                date('Y-m-d', strtotime("$today -" . ($max + 1) . ' years'))
            ))
            ->count();

        return [
            'residents' => $living()->count(),
            'male' => $living()->where('gender', 'Male')->count(),
            'female' => $living()->where('gender', 'Female')->count(),
            'zone' => $zone,
            'households' => DB::table('households')
                ->when($zone, fn ($q) => $q->where('zone_purok', $zone))
                ->count(),
            /* The bands a barangay reports in: under-five, school age,
               working age, senior. */
            'age_bands' => [
                ['label' => 'Under 5', 'total' => $ageBand(0, 4)],
                ['label' => '5 to 17', 'total' => $ageBand(5, 17)],
                ['label' => '18 to 59', 'total' => $ageBand(18, 59)],
                ['label' => '60 and over', 'total' => $ageBand(60, null)],
            ],
            'registered' => Resident::where('record_type', 'Resident')
                ->when($zone, fn ($q) => $q->where('zone_purok', $zone))
                ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
                ->count(),
            /* Of the living residents counted above — a sector tag on
               somebody who has died or moved out is not a person served. */
            'by_sector' => DB::table('resident_sectors')
                ->where('resident_sectors.is_active', true)
                ->whereIn('resident_id', $living()->select('id'))
                ->selectRaw('sector_type as label, count(*) as total')
                ->groupBy('sector_type')
                ->orderByDesc('total')
                ->get(),
            /* Every zone in the barangay's own order, the empty ones too: a
               zone with nobody on the register is itself worth seeing. */
            'by_zone' => (function () use ($living, $zone) {
                $counts = $living()->selectRaw('zone_purok, count(*) as total')
                    ->groupBy('zone_purok')->pluck('total', 'zone_purok');

                $rows = Zone::orderBy('sort_order')->pluck('name')
                    ->when($zone, fn ($names) => $names->filter(fn ($n) => $n === $zone))
                    ->map(fn ($name) => ['label' => $name, 'total' => (int) ($counts[$name] ?? 0)])
                    ->values()->all();

                /* A NULL zone and an empty one are both keyed '' here. */
                $unzoned = (int) ($counts[''] ?? 0);
                if (! $zone && $unzoned > 0) {
                    $rows[] = ['label' => 'No zone recorded', 'total' => $unzoned];
                }

                return $rows;
            })(),
        ];
    }

    /**
     * The Clerk's counter: certificates asked for and handed over.
     *
     * Asked for is counted by the day it was REQUESTED, handed over by the
     * day it was RELEASED — two different days for the same certificate, and
     * each belongs to its own.
     */
    private function certificates(string $from, string $to): array
    {
        $span = [$from . ' 00:00:00', $to . ' 23:59:59'];

        return [
            'requested' => Certificate::whereBetween('created_at', $span)->count(),
            'released' => Certificate::whereBetween('released_at', $span)->count(),
            'waiting' => Certificate::whereNotIn('status', ['Released', 'Cancelled'])->count(),
            'by_type' => DB::table('certificates_clearances')
                ->whereBetween('created_at', $span)
                ->selectRaw('certificate_type as label, count(*) as total')
                ->groupBy('certificate_type')
                ->orderByDesc('total')
                ->get(),
        ];
    }
}
