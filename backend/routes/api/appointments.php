<?php

use App\Http\Controllers\Api\Council\AppointmentController;
use Illuminate\Support\Facades\Route;

/*
| Council & Executive Appointments.
| Secretary can create walk-ins, approve/reject, record minutes, and delete.
| Punong Barangay has read-only access (index, show, calendar).
| Guarded by staff + deny_role:Clerk + office:Main Office,PB.
*/
Route::middleware('office:Main Office,PB')->group(function () {
    Route::get('appointments', [AppointmentController::class, 'index']);
    Route::get('appointments/calendar', [AppointmentController::class, 'calendar']);
    Route::get('appointments/{appointment}', [AppointmentController::class, 'show']);
    Route::post('appointments', [AppointmentController::class, 'store']);
    Route::post('appointments/{appointment}/approve', [AppointmentController::class, 'approve']);
    Route::post('appointments/{appointment}/reject', [AppointmentController::class, 'reject']);
    Route::put('appointments/{appointment}/minutes', [AppointmentController::class, 'updateMinutes']);
    Route::delete('appointments/{appointment}', [AppointmentController::class, 'destroy']);
});

