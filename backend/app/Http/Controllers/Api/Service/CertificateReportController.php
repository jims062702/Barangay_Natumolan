<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Support\DateWindow;
use Illuminate\Http\Request;

class CertificateReportController extends BaseController
{
    /**
     * How many certificates were asked for, over the windows a clerk is asked
     * about.
     *
     * Every window is counted in ONE pass and returned together, because the
     * question is never just "how many today" — it is "how many today, and is
     * that a lot?" Five separate calls would make the comparison the clerk's
     * job.
     *
     * Counted from `created_at`, which is when the certificate was ASKED for.
     * A clerk reporting volume is reporting demand, not output — a request
     * made today and released next week belongs to today.
     *
     * The boundaries are Philippine, not UTC. The server stores UTC, so a
     * request made at eight this morning in Tagoloan is stored as midnight,
     * and "today" counted in UTC would put it on yesterday. Every window here
     * is worked out in Manila time and then converted back.
     */
    public function report(Request $request)
    {
        /*
         * The five windows, defined once for the whole system in DateWindow —
         * including the definition of "mid-year" that used to live here, and
         * which the VAWC and Lupon dockets now read from the same place.
         */
        $windows = collect(DateWindow::PRESETS)
            ->mapWithKeys(fn (string $name) => [$name => DateWindow::preset($name)]);

        $counts = $windows
            ->map(fn (DateWindow $w) => $w->applyTo(Certificate::query(), 'created_at')->count())
            ->all();

        /*
         * The breakdown follows whichever window the clerk picked, so "what
         * are people asking for this month" and "what did they ask for all
         * year" are the same screen.
         */
        /*
         * A preset, or a named month or year — the same question the other
         * dockets take, so last December is reachable from here at all.
         * Falling back to this month keeps the page's old default.
         */
        $chosen = DateWindow::fromRequest($request) ?? $windows['month'];
        $span = [$chosen->from->utc()->toDateTimeString(), $chosen->to->utc()->toDateTimeString()];

        $byType = Certificate::whereBetween('created_at', $span)
            ->selectRaw('certificate_type, COUNT(*) as total')
            ->groupBy('certificate_type')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'certificate_type' => $row->certificate_type,
                'total' => (int) $row->total,
            ]);

        $byStatus = Certificate::whereBetween('created_at', $span)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($n) => (int) $n);

        /*
         * Who asked, and how often.
         *
         * Read two ways: it answers "how many has this resident asked for",
         * and a name near the top of it is worth a second look — the same
         * clearance requested four times in a month is usually one that was
         * never collected.
         */
        $perResident = Certificate::whereBetween('created_at', $span)
            ->whereNotNull('resident_id')
            ->selectRaw('resident_id, COUNT(*) as total')
            ->groupBy('resident_id')
            ->orderByDesc('total')
            ->limit(20)
            ->get();

        $residents = Resident::whereIn('id', $perResident->pluck('resident_id'))
            ->get(['id', 'resident_number', 'first_name', 'middle_name', 'last_name', 'suffix'])
            ->keyBy('id');

        return $this->success([
            'as_of' => DateWindow::now()->toDateTimeString(),
            'counts' => $counts,
            /*
             * The window that was actually applied, named. `period` stays for
             * the tile strip, which highlights one of the five; `window`
             * carries a named month or year, which is not one of them.
             */
            'period' => $windows->has($chosen->key) ? $chosen->key : null,
            'window' => $chosen->toArray(),
            'years' => DateWindow::yearsFrom(Certificate::min('created_at')),
            'period_from' => $chosen->from->toDateString(),
            'period_to' => $chosen->to->toDateString(),
            'by_type' => $byType,
            'by_status' => $byStatus,
            'by_resident' => $perResident->map(fn ($row) => [
                'resident_id' => $row->resident_id,
                'name' => $residents[$row->resident_id]->full_name ?? '—',
                'resident_number' => $residents[$row->resident_id]->resident_number ?? null,
                'total' => (int) $row->total,
            ])->values(),
        ], 'Certificate report');
    }
}
