<?php

use App\Http\Controllers\Api\Portal\AppointmentController;
use App\Http\Controllers\Api\Portal\CaseController;
use App\Http\Controllers\Api\Portal\CertificateController;
use App\Http\Controllers\Api\Portal\DashboardController;
use App\Http\Controllers\Api\Portal\FamilyController;
use App\Http\Controllers\Api\Portal\ProfileController;
use App\Http\Controllers\Api\Portal\RequestController;
use Illuminate\Support\Facades\Route;

/*
| Resident portal — role Resident, with a linked resident record.
|
| Loaded inside the auth:sanctum group of routes/api.php.
*/

Route::prefix('portal')->middleware('office:ResidentRole')->group(function () {
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
    Route::get('appointments', [AppointmentController::class, 'index']);
    Route::post('appointments', [AppointmentController::class, 'store']);
    Route::post('appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);
    Route::get('certificates', [CertificateController::class, 'index']);
    // What a certificate needs and costs, so the request form can say so.
    Route::get('certificate-services', [CertificateController::class, 'services']);
    Route::get('profile', [ProfileController::class, 'show']);
    /*
     * The one field on their own record a resident may change. Everything
     * else in the registry belongs to the Population Office.
     */
    Route::put('profile/occupation', [ProfileController::class, 'updateOccupation']);
    // Parents, lola/lolo, spouse, children and siblings, read-only.
    Route::get('family', [FamilyController::class, 'show']);
    /*
    | Their own KP cases and blotter entries. NOT VAWC — see the
    | method: the existence of such a case is itself confidential,
    | and the portal is opened on devices the survivor may share
    | with the person they are escaping.
    */
    Route::get('cases', [CaseController::class, 'index']);
});
