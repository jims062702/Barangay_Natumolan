<?php

use App\Http\Controllers\Api\Dashboard\BadgeController;
use App\Http\Controllers\Api\Dashboard\PulseController;
use App\Http\Controllers\Api\Population\ResidentLookupController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes — the map
|--------------------------------------------------------------------------
| This file says WHO may reach each part of the system; the routes of each
| part live in routes/api/<part>.php, loaded here inside the groups that
| guard them. The order of the requires is the order the routes were
| declared in, and it matters where two URLs could match the same request.
*/

/*
|--------------------------------------------------------------------------
| Public — no authentication
|--------------------------------------------------------------------------
| Accounts are BPO/Admin-created; there is intentionally NO public register.
*/
require __DIR__ . '/api/auth.php';

require __DIR__ . '/api/public.php';

require __DIR__ . '/api/chat.php';

/*
|--------------------------------------------------------------------------
| Signed in — staff and residents
|--------------------------------------------------------------------------
*/
Route::get('pulse', PulseController::class)->middleware('throttle:240,1');

Route::middleware('auth:sanctum')->group(function () {

    require __DIR__ . '/api/account.php';

    /*
     * Sidebar counts, for STAFF AND RESIDENTS alike.
     *
     * This sat inside the staff group, so a resident asking for it got a 403
     * — which the sidebar swallows, leaving no badges and no error. The
     * method gates on role and office itself, and answers only for the
     * caller's own office.
     */
    Route::get('dashboard/badges', [BadgeController::class, 'index']);

    /* Resident portal (role Resident, linked resident record required). */
    require __DIR__ . '/api/portal.php';

    /*
    |----------------------------------------------------------------------
    | Staff only — any office role; residents blocked
    |----------------------------------------------------------------------
    */
    Route::middleware('staff')->group(function () {
        require __DIR__ . '/api/dashboard.php';

        require __DIR__ . '/api/lookups.php';

        /* The resident register — the Population Office alone. */
        require __DIR__ . '/api/residents.php';

        /*
        | Counter verification — "is this person registered, and have they been
        | issued a portal account?" The front desk runs this before filing a
        | certificate, so it sits OUTSIDE the registry group: it answers a
        | yes/no about one person instead of opening the register.
        */
        Route::get('population/verify-resident', [ResidentLookupController::class, 'index'])
            ->middleware('office:Main Office,Population');

        require __DIR__ . '/api/certificates.php';

        require __DIR__ . '/api/chat-desk.php';

        require __DIR__ . '/api/service-requests.php';

        /* Everything in here is off-limits to the Clerk, whose work is requests and certificates. */
        Route::middleware('deny_role:Clerk')->group(function () {
            require __DIR__ . '/api/records.php';


            require __DIR__ . '/api/sessions.php';

            require __DIR__ . '/api/appointments.php';
        });

        require __DIR__ . '/api/sk.php';

        require __DIR__ . '/api/vawc.php';

        require __DIR__ . '/api/lupon.php';

        /* Population Office: the register as a file, the RBIM census, households and accounts. */
        require __DIR__ . '/api/transfer.php';

        require __DIR__ . '/api/rbim.php';

        require __DIR__ . '/api/population.php';

        require __DIR__ . '/api/health.php';

        require __DIR__ . '/api/admin.php';
    });
});
