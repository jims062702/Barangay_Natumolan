<?php

use App\Http\Controllers\Api\Health\ChildHealthController;
use App\Http\Controllers\Api\Health\ImmunizationController;
use App\Http\Controllers\Api\Health\MaternalHealthController;
use App\Http\Controllers\Api\Health\PatientController;
use App\Http\Controllers\Api\Health\ReportController;
use App\Http\Controllers\Api\Health\VisitController;
use Illuminate\Support\Facades\Route;

/*
| Barangay Health Station
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

/*
| Barangay Health Station — health personnel only.
*/
Route::prefix('health')->middleware('office:Health Station')->group(function () {
    Route::get('visits', [VisitController::class, 'index']);
    Route::post('visits', [VisitController::class, 'store']);
    Route::get('patients/{resident}/history', [PatientController::class, 'history']);
    Route::get('immunization', [ImmunizationController::class, 'index']);
    Route::post('immunization', [ImmunizationController::class, 'store']);
    Route::get('immunization-status/{resident}', [ImmunizationController::class, 'status']);
    Route::get('maternal-health', [MaternalHealthController::class, 'index']);
    Route::post('maternal-health', [MaternalHealthController::class, 'store']);
    Route::get('child-health', [ChildHealthController::class, 'index']);
    Route::post('child-health', [ChildHealthController::class, 'store']);
    Route::get('reports/coverage', [ReportController::class, 'coverage']);
});
