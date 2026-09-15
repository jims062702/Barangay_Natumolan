<?php

use App\Http\Controllers\Api\Service\CertificateCatalogueController;
use App\Http\Controllers\Api\Service\CertificateController;
use App\Http\Controllers\Api\Service\CertificatePhotoController;
use App\Http\Controllers\Api\Service\CertificateReportController;
use App\Http\Controllers\Api\Service\CertificateWorkflowController;
use Illuminate\Support\Facades\Route;

/*
| Certificates & clearances.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

/*
| Certificates & clearances. Three presses, all the clerk's: accept,
| print, release. The Punong Barangay signs the paper on its way to
| the counter, which is a thing that happens at a desk rather than a
| route here. Nothing on this line is a decision about the request.
|
| Denied to the Secretary at the route, not merely hidden from the
| menu: two people working one counter list is how the same
| certificate gets started twice.
*/
Route::middleware(['office:Main Office,PB', 'deny_role:Secretary'])->group(function () {
    // Declared before the apiResource, or "report" is swallowed as an id.
    Route::get('certificates/report', [CertificateReportController::class, 'report']);
    Route::get('certificates/fee-schedule', [CertificateCatalogueController::class, 'feeSchedule']);
    Route::get('certificates/requirements', [CertificateCatalogueController::class, 'requirements']);
    Route::apiResource('certificates', CertificateController::class)
        ->only(['index', 'store', 'show', 'update']);
    Route::post('certificates/{certificate}/accept', [CertificateWorkflowController::class, 'accept']);
    /* The counter photograph, before it is printed. */
    Route::post('certificates/{certificate}/photo', [CertificatePhotoController::class, 'upload']);
    /* The same photograph sent as data, from a device that took it with
       no line — a file upload cannot be held in the offline queue. */
    Route::post('certificates/{certificate}/photo-data', [CertificatePhotoController::class, 'uploadData']);
    Route::post('certificates/{certificate}/mark-printed', [CertificateWorkflowController::class, 'markPrinted']);
    Route::post('certificates/{certificate}/release', [CertificateWorkflowController::class, 'release']);
    Route::post('certificates/{certificate}/reprint', [CertificateWorkflowController::class, 'reprint']);
});
