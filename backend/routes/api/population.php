<?php

use App\Http\Controllers\Api\Population\AnalyticsController;
use App\Http\Controllers\Api\Population\EventController;
use App\Http\Controllers\Api\Population\HouseholdController;
use App\Http\Controllers\Api\Population\ResidentAccountController;
use App\Http\Controllers\Api\Population\SectorController;
use Illuminate\Support\Facades\Route;

/*
| Population Office (BPO) — owns the registry and the portal accounts.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::prefix('population')->middleware('office:Population,AdminRole')->group(function () {
    Route::get('households', [HouseholdController::class, 'index']);
    Route::get('households/{household}', [HouseholdController::class, 'show']);
    Route::post('households', [HouseholdController::class, 'store']);
    Route::put('households/{household}', [HouseholdController::class, 'update']);
    Route::delete('households/{household}', [HouseholdController::class, 'destroy']);
    Route::put('households/{household}/head', [HouseholdController::class, 'setHead']);
    Route::post('households/transfer-resident', [HouseholdController::class, 'transferResident']);
    // Who owned it before, and why it changed hands.
    Route::get('households/{household}/owner-history', [HouseholdController::class, 'ownerHistory']);
    Route::get('events', [EventController::class, 'index']);
    Route::post('events', [EventController::class, 'store']);
    Route::put('events/{event}/verify', [EventController::class, 'verify']);
    Route::get('sectors/{sector}', [SectorController::class, 'show']);
    Route::get('analytics', [AnalyticsController::class, 'index']);
    Route::get('reports/sectoral', [SectorController::class, 'report']);
    Route::get('residents/{resident}/check-account-email', [ResidentAccountController::class, 'checkEmail']);
    Route::post('residents/{resident}/create-account', [ResidentAccountController::class, 'store']);
    Route::get('accounts', [ResidentAccountController::class, 'index']);
    // "I never got the email" — sends a fresh activation code.
    Route::post('accounts/{user}/resend-activation', [ResidentAccountController::class, 'resendActivation']);
    Route::put('accounts/{user}/toggle-status', [ResidentAccountController::class, 'toggleActive']);

    /*
    | A password set at the counter, for a resident who cannot get at
    | their email. Residents only — enforced in the controller, not
    | here, because a route file is not where that belongs.
    */
});
