<?php

use App\Http\Controllers\Api\Portal\CaseController;
use App\Http\Controllers\Api\Portal\CertificateController;
use App\Http\Controllers\Api\Portal\ComplaintController;
use App\Http\Controllers\Api\Portal\DashboardController;
use App\Http\Controllers\Api\Portal\EmailChangeController;
use App\Http\Controllers\Api\Portal\FamilyController;
use App\Http\Controllers\Api\Portal\HealthController;
use App\Http\Controllers\Api\Portal\VawcReportController;
use App\Http\Controllers\Api\Portal\VawcRecordController;
use App\Http\Controllers\Api\Portal\ResidentCardController;
use App\Http\Controllers\Api\Portal\ProfileController;
use App\Http\Controllers\Api\Portal\RequestController;
use Illuminate\Support\Facades\Route;

/*
| Resident portal — role Resident, with a linked resident record.
|
| Loaded inside the auth:sanctum group of routes/api.php.
*/

Route::prefix('portal')->middleware(['office:ResidentRole', 'resident_still_here'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'show']);
    Route::get('requests', [RequestController::class, 'index']);
    Route::post('requests', [RequestController::class, 'store']);
    Route::get('requests/{serviceRequest}', [RequestController::class, 'show']);

    /*
     | Taking one back, and changing their mind again.
     |
     | No DELETE, deliberately. A request carries a number from the same
     | series the counter issues from, and its certificate carries
     | another — removing the row would strand both. Cancelling is a
     | status, so the record stays whole and can be resumed.
     */
    Route::post('requests/{serviceRequest}/cancel', [RequestController::class, 'cancel']);
    Route::post('requests/{serviceRequest}/resume', [RequestController::class, 'resume']);
    Route::get('certificates', [CertificateController::class, 'index']);
    // What a certificate needs and costs, so the request form can say so.
    Route::get('certificate-services', [CertificateController::class, 'services']);
    Route::get('death-certificate/deceased-search', [CertificateController::class, 'searchDeceased']);
    /*
     | Their own health record — READ ONLY, and only their own.
     |
     | GET and nothing else. A health record is written at the station by the
     | person who took the reading; a patient reading theirs is right, a
     | patient editing it is not. Whose record it is comes from the session,
     | never from the URL.
     */
    Route::get('health', [HealthController::class, 'show']);
    Route::get('profile', [ProfileController::class, 'show']);
    /* Their Barangay Resident ID — viewed, downloaded, printed; never edited. */
    Route::get('resident-card', [ResidentCardController::class, 'show']);
    Route::post('resident-card/check', [ResidentCardController::class, 'check'])->middleware('throttle:120,1,portal-resident-card-check');
    /*
     * The one field on their own record a resident may change. Everything
     * else in the registry belongs to the Population Office.
     */
    /* Occupation, civil status and contact number — the three the resident
       owns. Named for what it does now rather than for the one field it
       started with. */
    Route::put('profile/details', [ProfileController::class, 'updateDetails']);
    /*
     | Changing the address they sign in with — two steps, always.
     |
     | The new address waits in `pending_email` while a code goes to it, and
     | becomes the login only when that code comes back. It is the same two
     | steps before activation as after: somebody who registered with the
     | wrong address proves the right one the same way.
     */
    Route::post('profile/email', [EmailChangeController::class, 'request']);
    Route::post('profile/email/confirm', [EmailChangeController::class, 'confirm']);
    Route::delete('profile/email', [EmailChangeController::class, 'cancel']);
    // Parents, lola/lolo, spouse, children and siblings, read-only.
    Route::get('family', [FamilyController::class, 'show']);
    /*
    | Their own KP cases. NOT VAWC — see the
    | method: the existence of such a case is itself confidential,
    | and the portal is opened on devices the survivor may share
    | with the person they are escaping.
    */
    Route::get('cases', [CaseController::class, 'index']);

    /*
    | Beginning a KP complaint from the portal.
    |
    | A reference number, not a case. The resident still comes to the office
    | with the ID they uploaded, the complaint is still verified there, the
    | fee is still paid there, and only the Lupon pressing Accept raises a
    | case. What it buys is that the office has read the complaint before the
    | resident is standing at the counter.
    */
    Route::get('complaints', [ComplaintController::class, 'index']);
    Route::post('complaints', [ComplaintController::class, 'store'])
        ->middleware('throttle:60,1,portal-complaints');

    /* Their VAWC reports to the VAW Desk — sent, and followed. */
    Route::get('vawc-reports', [VawcReportController::class, 'index']);
    Route::post('vawc-reports', [VawcReportController::class, 'store'])->middleware('throttle:60,1,portal-vawc-report');

    /* Complete VAWC records: online complaints, cases, protection orders, and tracking. */
    Route::get('vawc-records', [VawcRecordController::class, 'index']);
});
