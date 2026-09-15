<?php

use App\Http\Controllers\Api\Records\AdministrativeRecordController;
use Illuminate\Support\Facades\Route;

/*
| Barangay administrative records — ordinances, resolutions and the rest.
|
| Loaded inside the staff group, where the Clerk is already turned away.
*/

Route::prefix('administrative-records')->middleware('office:Main Office,PB')->group(function () {
    Route::get('statistics', [AdministrativeRecordController::class, 'statistics']);
    // Adoption is the Punong Barangay's act, not the secretary's.
    Route::post('{administrativeRecord}/approve', [AdministrativeRecordController::class, 'approve'])
        ->middleware('office:PB');
    Route::post('{administrativeRecord}/archive', [AdministrativeRecordController::class, 'archive']);
});
Route::apiResource('administrative-records', AdministrativeRecordController::class)
    ->only(['index', 'store', 'show', 'update', 'destroy'])
    ->middleware('office:Main Office,PB');
