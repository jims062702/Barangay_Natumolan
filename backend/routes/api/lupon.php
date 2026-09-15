<?php

use App\Http\Controllers\Api\Lupon\CaseController;
use App\Http\Controllers\Api\Lupon\HearingController;
use App\Http\Controllers\Api\Lupon\ProceedingController;
use App\Http\Controllers\Api\Lupon\ReportController;
use App\Http\Controllers\Api\Lupon\SettlementController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Lupon Tagapamayapa
|--------------------------------------------------------------------------
| Loaded inside the signed-in staff group of routes/api.php, so every route
| here already requires a staff session. The docket is the Lupon office's and
| the Punong Barangay's.
*/

/*
| The hearing calendar, and only that.
|
| The barangay secretary takes the minutes at a mediation, so they
| reach the hearings — but not the cases behind them, not the
| settlements and not the reports. Widening the whole Lupon gate to
| give them a calendar would hand over the docket with it.
|
| The Clerk is kept out: certificates are their work, not the KP's.
*/
Route::prefix('lupon')
    ->middleware(['office:Lupon,PB,Main Office', 'deny_role:Clerk'])
    ->group(function () {
        Route::get('hearings', [HearingController::class, 'index']);
        Route::put('hearings/{hearing}', [HearingController::class, 'update']);
        Route::post('hearings/{hearing}/summons', [HearingController::class, 'recordSummons']);
        Route::post('hearings/{hearing}/reschedule', [HearingController::class, 'reschedule']);
    });

Route::prefix('lupon')->middleware('office:Lupon,PB')->group(function () {
    Route::get('deadlines', [ReportController::class, 'deadlines']);
    Route::get('reports/monthly-transmittal', [ReportController::class, 'monthlyTransmittal']);

    // The compliance register, spanning the whole docket.
    // (The hearing calendar sits in its own group above — the
    // barangay secretary minutes those hearings without being given
    // the docket they belong to.)
    Route::get('settlements', [SettlementController::class, 'index']);
    Route::post('settlements/{settlement}/action', [SettlementController::class, 'registerAction']);
    Route::get('cases', [CaseController::class, 'index']);
    Route::post('cases', [CaseController::class, 'store']);
    Route::get('cases/{case}', [CaseController::class, 'show']);
    Route::post('cases/{case}/screen-jurisdiction', [CaseController::class, 'screenJurisdiction']);
    Route::post('cases/{case}/hearings', [HearingController::class, 'store']);
    Route::put('cases/{case}/hearings/{hearing}', [HearingController::class, 'recordOutcome']);
    Route::post('cases/{case}/mediation', [ProceedingController::class, 'mediation']);
    Route::post('cases/{case}/conciliation', [ProceedingController::class, 'conciliation']);
    Route::post('cases/{case}/settlement', [SettlementController::class, 'store']);
    Route::post('cases/{case}/settlement-action', [SettlementController::class, 'caseAction']);
    Route::get('cases/{case}/forms', [ReportController::class, 'forms']);
});
