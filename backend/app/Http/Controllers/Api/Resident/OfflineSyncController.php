<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Models\Resident\Resident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The register in pages, for a counter device that keeps working offline.
 */
class OfflineSyncController extends BaseController
{
    /**
     * The register, in pages, for a device that has to work with no line.
     *
     * WHY THIS EXISTS. The clerk's first move on any walk-in is to search
     * for the person in front of them. That search is a round trip, so with
     * the line down it returns nothing and the counter stops — the resident
     * is standing there, on the register, and the screen says no matches.
     * Caching the register on the device is what makes the rest of offline
     * mode worth having.
     *
     * LEAN ON PURPOSE. Only what the counter actually needs: enough to find
     * a person, tell two namesakes apart, and print their certificate. The
     * full record is far wider, and 20,000 of them would be a download the
     * barangay's line cannot finish. Nothing sensitive travels — no email,
     * no household links, and nothing from VAWC, which never leaves the
     * server at all.
     *
     * TWO MODES. Without `since` it walks the whole register by id. With
     * `since` it returns only what changed, which after the first sync is a
     * few dozen rows rather than twenty thousand.
     */
    public function index(Request $request): JsonResponse
    {
        $limit = min(max((int) $request->input('limit', 1000), 1), 2000);
        $cursor = (int) $request->input('cursor', 0);
        $since = $request->input('since');

        $query = Resident::query()
            /* A merged record is a duplicate that has been folded into
               another. Caching it would offer the clerk a person who no
               longer exists as a separate record. */
            ->whereNull('merged_into_id')
            ->when($cursor > 0, fn ($q) => $q->where('id', '>', $cursor))
            ->orderBy('id')
            ->limit($limit);

        if (is_string($since) && $since !== '') {
            try {
                $query->where('updated_at', '>', \Carbon\Carbon::parse($since));
            } catch (\Throwable) {
                return $this->error('The "since" value is not a date the system can read.', 422);
            }
        }

        $rows = $query->get([
            'id', 'resident_number', 'record_type', 'life_status', 'gender',
            'first_name', 'middle_name', 'last_name', 'suffix',
            'birthdate', 'birthdate_is_estimated', 'birth_place', 'nationality',
            'civil_status', 'zone_purok', 'address',
            'length_of_residence_years', 'contact_number', 'email',
            'updated_at',
        ]);

        $last = $rows->last();

        return $this->success([
            'rows' => $rows,

            /* Null means "that was the last page". The client stops on null
               rather than on a short page: a page can be short because the
               limit landed exactly on the end, and stopping early there
               would silently cache a partial register. */
            'next_cursor' => $rows->count() === $limit && $last ? $last->id : null,

            /*
             * The whole register's size, so the device can notice drift.
             *
             * Residents are deleted outright here — there is no soft-delete
             * column — so a removed record simply stops appearing, and an
             * incremental pull can never mention it. Comparing counts is
             * what catches that: when they disagree, the device throws its
             * copy away and pulls the register again.
             */
            'total' => Resident::whereNull('merged_into_id')->count(),

            /* What to pass as `since` next time. The SERVER's clock, because
               the device's may be minutes out and would either re-fetch the
               world or skip the rows written in the gap. */
            'server_time' => now()->toIso8601String(),
        ], 'Register page');
    }
}
