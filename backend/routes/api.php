<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Population\ResidentLookupController;
use App\Http\Controllers\Api\Dashboard\BadgeController;
use App\Http\Controllers\Api\Dashboard\ExecutiveController;
use App\Http\Controllers\Api\Dashboard\PulseController;
use App\Http\Controllers\Api\Dashboard\SummaryController;
use App\Http\Controllers\Api\Public\AppointmentRequestController;
use App\Http\Controllers\Api\Public\AssistantController;
use App\Http\Controllers\Api\Public\CertificateVerificationController;
use App\Http\Controllers\Api\Public\ContactController;
use App\Http\Controllers\Api\Public\LandingController;
use App\Http\Controllers\Api\Public\ServiceDirectoryController;
use App\Http\Controllers\Api\Service\CertificateCatalogueController;
use App\Http\Controllers\Api\RbimCensusController;
use App\Http\Controllers\Api\ResidentController;

/*
|--------------------------------------------------------------------------
| Public — no authentication
|--------------------------------------------------------------------------
| Accounts are BPO/Admin-created; there is intentionally NO public register.
*/
require __DIR__ . '/api/auth.php';

Route::get('services', [ServiceDirectoryController::class, 'services']);
Route::get('contact', [ServiceDirectoryController::class, 'contact']);
Route::get('announcements', [LandingController::class, 'announcements']);
Route::get('announcements/{announcement}', [LandingController::class, 'announcement']);
Route::get('hero-slides', [LandingController::class, 'heroSlides']);
Route::get('officials', [LandingController::class, 'officials']);

/*
| An appointment asked for by somebody who is not on the register.
|
| Open to the internet, so throttled — but not as hard as it first was.
|
| A REFUSED request counts against the limit too, so at three an hour a
| visitor who mistyped their mobile number twice and corrected it was locked
| out for an hour by the form telling them off. Ten leaves room to get it
| wrong; the real protection against a spam booking is elsewhere: office
| hours, one request per number per day, and Pending rather than Scheduled.
*/
Route::post('appointment-requests', [AppointmentRequestController::class, 'store'])
    ->middleware('throttle:10,60');
Route::get('stats', [LandingController::class, 'stats']);
Route::get('verify/{referenceNumber}', [CertificateVerificationController::class, 'show']);
Route::post('assistant/inquiry', [AssistantController::class, 'ask']);

require __DIR__ . '/api/chat.php';
Route::post('contact', [ContactController::class, 'store'])->middleware('throttle:5,1');

/*
|--------------------------------------------------------------------------
| Authenticated
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    /*
    | "Has anything changed?" — asked about once a second by every open tab.
    |
    | Counters only, no records, so it needs no gate beyond being signed in.
    | Throttled high because it is MEANT to be asked often; one call is a
    | single indexed read of a table with a dozen rows.
    */
    Route::get('pulse', PulseController::class)->middleware('throttle:240,1');


    require __DIR__ . '/api/account.php';

    /*
    |----------------------------------------------------------------------
    | Resident portal (role Resident, linked resident record required)
    |----------------------------------------------------------------------
    */
    /*
     * Sidebar counts, for STAFF AND RESIDENTS alike.
     *
     * This sat inside the staff group, so a resident asking for it got a 403
     * — which the sidebar swallows, leaving no badges and no error. The
     * resident half of badges() had been written and was unreachable. The
     * method gates on role and office itself, which is where that decision
     * belongs.
     */
    Route::get('dashboard/badges', [BadgeController::class, 'index']);

    require __DIR__ . '/api/portal.php';

    /*
    |----------------------------------------------------------------------
    | Staff-only area (any office role; residents blocked)
    |----------------------------------------------------------------------
    */
    Route::middleware('staff')->group(function () {

        // Dashboards & notifications (all staff, incl. clerk)
        Route::get('dashboard/summary', [SummaryController::class, 'summary']);
        Route::get('dashboard/pending-items', [SummaryController::class, 'pendingItems']);
        /*
        | The numbers beside the sidebar items. Open to every staff account
        | because it answers only for the caller's OWN office — the method
        | gates each figure the same way the menu and the routes do.
        */

        // Punong Barangay executive view — the whole-barangay picture.
        Route::get('dashboard/executive', [ExecutiveController::class, 'show'])
            ->middleware('office:PB');

        /*
        | Name lookup stays open to every office: VAWC, Health and the Lupon
        | all need the resident picker to attach a person to their own record.
        | It returns identity fields only — never the browsable registry.
        */
        Route::get('residents/search', [ResidentController::class, 'search']);

        /*
         | The register in pages, for a device that keeps working offline.
         |
         | Staff only, and deliberately inside this group: a resident has no
         | business downloading the barangay's register, and the portal
         | routes are a different group entirely.
         */
        Route::get('residents/offline-sync', [ResidentController::class, 'offlineSync']);

        /*
         | Which certificate-number series this office owns, and where it has
         | reached — so a device with no line can carry on numbering from
         | there without ever colliding with another office.
         */
        Route::get('certificates/number-series', [CertificateCatalogueController::class, 'numberSeries']);
        Route::get('residents/household-options', [ResidentController::class, 'householdOptions']);

        /*
        | Resident registry proper — the Population Office (BPO) alone. They
        | are the only office that registers a person, so they are the only
        | one that browses, edits or classifies the registry. Every other
        | office attaches a resident through `residents/search` above.
        */
        Route::middleware('office:Population')->group(function () {
            /*
            | Family tree. `family/{relation}` REGISTERS a new person and
            | links them in one step (the Add parent / Add child / Add spouse
            | buttons); `family/link` connects two people who are both already
            | on the register. Declared before the apiResource so
            | `residents/{resident}/family/...` is never swallowed by it.
            */
            /*
            | Duplicate repair. Declared with the family routes because that is
            | what a split record breaks first: half the family on one copy,
            | half on the other.
            */
            Route::get('residents/{resident}/duplicates', [ResidentController::class, 'duplicates']);
            Route::post('residents/{resident}/merge', [ResidentController::class, 'merge']);
            // Merging is a judgement call, so it has to be reversible.
            Route::get('residents/{resident}/merges', [ResidentController::class, 'merges']);
            Route::post('residents/{resident}/merges/{merge}/undo', [ResidentController::class, 'unmerge']);

            /*
            | Marriage is a HISTORY: ending one records why, frees both to
            | marry again, and keeps the old row so an older certificate
            | naming a different spouse still makes sense.
            */
            /*
            | Living or deceased. Not the same as deactivating a record:
            | the family links stay, the portal login goes, and a marriage
            | ends as widowed.
            */
            Route::post('residents/{resident}/life-status', [ResidentController::class, 'updateLifeStatus']);

            // A relative who lived elsewhere has moved in: convert rather
            // than re-register, so their family links come with them.
            Route::post('residents/{resident}/convert-to-resident', [ResidentController::class, 'convertToResident']);

            Route::get('residents/{resident}/marriages', [ResidentController::class, 'marriages']);
            Route::post('residents/{resident}/marriages/{marriage}/end', [ResidentController::class, 'endMarriage']);
            Route::post('residents/{resident}/marriages/{marriage}/visibility', [ResidentController::class, 'marriageVisibility']);

            /*
            | Guardianship: who is raising a child when the parents are not.
            | Recorded on the family routes because that is where the gap
            | shows — a child registered here whose mother and father are both
            | on the register as living somewhere else.
            */
            Route::post('residents/{resident}/guardianships/{guardianship}/end', [ResidentController::class, 'endGuardianship']);

            Route::get('residents/{resident}/family', [ResidentController::class, 'family']);
            Route::post('residents/{resident}/family/link', [ResidentController::class, 'linkRelative']);
            Route::post('residents/{resident}/family/{relation}', [ResidentController::class, 'addRelative'])
                ->whereIn('relation', ['parent', 'child', 'spouse', 'guardian']);
            Route::delete('residents/{resident}/family/{relative}', [ResidentController::class, 'unlinkRelative']);

            /*
            | A whole household in one submission — the shape a house-to-house
            | visit actually produces. Declared BEFORE the apiResource so
            | `residents/household` is not swallowed as `residents/{id}`.
            */
            Route::post('residents/household', [ResidentController::class, 'storeHousehold']);

            Route::apiResource('residents', ResidentController::class);
            Route::post('residents/{resident}/sectors', [ResidentController::class, 'addSector']);
            Route::delete('residents/{resident}/sectors/{sector}', [ResidentController::class, 'removeSector']);
        });

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

        /*
        | Request intake — the Clerk's, and the PB's to oversee.
        |
        | The window queue that used to sit here is gone: it numbered people
        | for a counter that issues documents from the request itself, so the
        | same piece of work was tracked in two places.
        */
        require __DIR__ . '/api/service-requests.php';

        /*
        | Everything below is off-limits to the Clerk (requests & certificates only).
        */
        Route::middleware('deny_role:Clerk')->group(function () {
            require __DIR__ . '/api/records.php';

            require __DIR__ . '/api/appointments.php';

            require __DIR__ . '/api/sessions.php';

        });

        require __DIR__ . '/api/sk.php';

        require __DIR__ . '/api/vawc.php';

        require __DIR__ . '/api/lupon.php';

        /*
        | Population Office (BPO) — owns the registry & portal accounts.
        */
        /*
         | RBIM baseline census — the DILG household form.
         |
         | Collected by the BHW (Health Station) and encoded, then reviewed
         | by the Population Office. The office gate is wider than the rest
         | of the population module for exactly that reason; the controller
         | narrows reconciliation to the BPO itself.
         */
        /*
         | Getting the register in and out as a spreadsheet.
         |
         | Preview before import, always: the office is handing the system a
         | file from somewhere else, and the preview is the only chance
         | anybody gets to look before four hundred records change.
         */
        require __DIR__ . '/api/transfer.php';

        Route::get('rbim/code-lists', [RbimCensusController::class, 'codeLists']);
        // Is this house already on the register, and who is in it?
        Route::get('rbim/verify-household', [RbimCensusController::class, 'verifyHousehold']);
        // Is this address free to be somebody's login?
        Route::get('rbim/check-email', [RbimCensusController::class, 'checkEmail']);
        Route::get('rbim', [RbimCensusController::class, 'index']);
        Route::post('rbim', [RbimCensusController::class, 'store']);
        Route::get('rbim/{rbimCensus}', [RbimCensusController::class, 'show']);
        Route::put('rbim/{rbimCensus}', [RbimCensusController::class, 'update']);
        // Submitting is what registers the household — see the controller.
        Route::post('rbim/{rbimCensus}/submit', [RbimCensusController::class, 'submit']);
        Route::put('rbim/{rbimCensus}/members/{member}', [RbimCensusController::class, 'matchMember']);
        Route::delete('rbim/{rbimCensus}', [RbimCensusController::class, 'destroy']);

        require __DIR__ . '/api/population.php';

        require __DIR__ . '/api/health.php';

        require __DIR__ . '/api/admin.php';
    });
});
