<?php

use App\Http\Controllers\Api\Council\SessionController;
use Illuminate\Support\Facades\Route;

/*
| Sessions of the Sangguniang Barangay.
|
| Loaded inside the staff group, where the Clerk is already turned away.
*/

/*
| The session record — the minutes of the Sangguniang Barangay.
|
| The secretary writes it and the Punong Barangay adopts it.
| Adoption is a separate route with a narrower gate on purpose: a
| secretary who could adopt their own minutes would make the
| status mean nothing.
*/
Route::middleware('office:Main Office,PB')->group(function () {
    Route::apiResource('sessions', SessionController::class)
        ->parameters(['sessions' => 'barangaySession'])
        ->only(['index', 'store', 'show', 'update', 'destroy']);

    Route::post('sessions/{barangaySession}/adopt', [SessionController::class, 'adopt'])
        ->middleware('office:PB');
});
