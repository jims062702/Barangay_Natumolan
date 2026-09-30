<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Models\Population\Zone;
use Illuminate\Http\Request;

/**
 * The zones of the barangay: a READ-ONLY lookup, shared by every office.
 *
 * Every form that asks where somebody lives needs this list — the registry
 * intake, the RBIM census, the household record and its filter, the Office
 * Report and the consolidated return — and `zone_purok` sits on every
 * resident and household row. So the list stays, and stays open to any
 * signed-in staff account.
 *
 * WHAT WENT IS THE SCREEN THAT MANAGED IT. "Zones & BHWs" came off the
 * menu, and store/update/destroy went with it, along with the barangay
 * health workers that page attached to each zone — nothing else in the
 * system ever read a BHW.
 *
 * A consequence the office should know: with the management screen gone
 * there is no longer a way to ADD a zone from inside the app. The list is
 * whatever the table holds. If the barangay splits a zone, that needs a
 * screen again — or a hand on the database.
 */
class ZoneController extends BaseController
{
    /** Every zone in order. Read by every office, written by none. */
    public function index(Request $request)
    {
        $zones = Zone::query()
            ->when(
                /* Forms ask for the ones still in use. A retired zone is
                   still readable on the records that name it. */
                ! $request->boolean('include_inactive'),
                fn ($query) => $query->where('is_active', true)
            )
            ->inOrder()
            ->get();

        return $this->success(['zones' => $zones], 'Zones retrieved');
    }
}
