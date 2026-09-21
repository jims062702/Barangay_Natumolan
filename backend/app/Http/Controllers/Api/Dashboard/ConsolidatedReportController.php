<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\ImmunizationRecord;
use App\Models\Health\MaternalRecord;
use App\Models\Health\Visit;
use App\Models\Lupon\CaseFile as LuponCase;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Payment;
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
     * Which sections each office may read.
     *
     * SEGREGATED BY DEPARTMENT. One combined return was the only thing this
     * produced, and only two people could open it — so the VAWC desk, which
     * has to file its own return, was left transcribing figures off its own
     * screens by hand.
     *
     * Each desk now gets its own section and only its own. The Secretary and
     * the Punong Barangay still see all three, because they are the ones who
     * sign for the barangay as a whole.
     *
     * The office name is the one the middleware already checks, so a desk
     * cannot reach a section by asking for it in the query string.
     */
    private const READABLE = [
        'Main Office' => ['lupon', 'vawc', 'health'],
        'PB' => ['lupon', 'vawc', 'health'],
        'Lupon' => ['lupon'],
        'VAWC' => ['vawc'],
        'Health Station' => ['health'],
    ];

    public function show(Request $request)
    {
        [$from, $to, $label] = $this->window($request);

        $allowed = self::READABLE[$request->user()?->office] ?? [];

        if ($allowed === []) {
            return $this->error('This office has no consolidated return to read.', 403);
        }

        /*
         * `section` narrows what is BUILT, not what is permitted.
         *
         * Asking for one the office may not read returns that office's own
         * sections instead of an error: the parameter is a view control on a
         * page, and a desk that bookmarks the wrong tab should see their own
         * figures rather than a refusal they cannot act on.
         */
        $asked = $request->input('section');
        $sections = in_array($asked, $allowed, true) ? [$asked] : $allowed;

        $report = [
            'period' => ['from' => $from, 'to' => $to, 'label' => $label],
            /* So the page can draw only the tabs this office may open. */
            'sections' => $allowed,
        ];

        foreach ($sections as $section) {
            $report[$section] = match ($section) {
                'lupon' => $this->lupon($from, $to),
                'vawc' => $this->vawc($from, $to),
                'health' => $this->health($from, $to),
            };
        }

        return $this->success($report, 'Consolidated report retrieved');
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

    private function health(string $from, string $to): array
    {
        $span = [$from . ' 00:00:00', $to . ' 23:59:59'];

        return [
            'visits' => Visit::whereBetween('created_at', $span)->count(),
            'immunizations' => ImmunizationRecord::whereBetween('created_at', $span)->count(),
            'maternal_records' => MaternalRecord::whereBetween('created_at', $span)->count(),
        ];
    }
}
