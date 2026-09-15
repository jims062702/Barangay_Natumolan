<?php

use App\Http\Controllers\Api\Service\AppointmentController;
use Illuminate\Support\Facades\Route;

/*
| Appointments at the office.
|
| Loaded inside the staff group, where the Clerk is already turned away.
*/

// Appointments — booked at the front desk, so the same office
// that runs intake (plus the PB, who is scheduled into them).
Route::middleware('office:Main Office,PB')->group(function () {
    Route::apiResource('appointments', AppointmentController::class);
    Route::post('appointments/{appointment}/confirm', [AppointmentController::class, 'confirm']);
    Route::post('appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);

    /*
     | What actually happened: who came, when it really ran, and
     | what was agreed. The secretary's act — booking is the
     | desk's, and the two are separate verbs so they can be
     | separate people.
     */
    Route::post('appointments/{appointment}/minutes', [AppointmentController::class, 'minutes']);
});
