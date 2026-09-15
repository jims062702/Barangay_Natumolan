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

Route::prefix('population')->middleware('office:Population')->group(function () {
    Route::get('households', [HouseholdController::class, 'index']);
    Route::post('households', [HouseholdController::class, 'store']);
    Route::put('households/{household}', [HouseholdController::class, 'update']);
    Route::put('households/{household}/head', [HouseholdController::class, 'setHead']);
    // Who owned it before, and why it changed hands.
    Route::get('households/{household}/owner-history', [HouseholdController::class, 'ownerHistory']);
    Route::get('events', [EventController::class, 'index']);
    Route::post('events', [EventController::class, 'store']);
    Route::put('events/{event}/verify', [EventController::class, 'verify']);
    Route::get('sectors/{sector}', [SectorController::class, 'show']);
    Route::get('analytics', [AnalyticsController::class, 'index']);
    Route::get('reports/sectoral', [SectorController::class, 'report']);
    Route::post('residents/{resident}/create-account', [ResidentAccountController::class, 'store']);
    Route::post('residents/{resident}/change-password', [ResidentAccountController::class, 'changePassword']);
    Route::get('accounts', [ResidentAccountController::class, 'index']);
    Route::post('accounts/{user}/toggle', [ResidentAccountController::class, 'toggle']);
    // "I never got the email" — sends a fresh activation code.
    Route::post('accounts/{user}/resend-activation', [ResidentAccountController::class, 'resendActivation']);

    /*
    | A password set at the counter, for a resident who cannot get at
    | their email. Residents only — enforced in the controller, not
    | here, because a route file is not where that belongs.
    */
    Route::post('accounts/{user}/reset-password', [ResidentAccountController::class, 'resetPassword']);
});
