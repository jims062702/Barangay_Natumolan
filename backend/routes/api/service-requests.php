<?php

use App\Http\Controllers\Api\Service\ServiceRequestController;
use Illuminate\Support\Facades\Route;

/*
| Request intake — the Clerk's, and the PB's to oversee.
|
| The window queue that used to sit here is gone: it numbered people for a
| counter that issues documents from the request itself, so the same piece
| of work was tracked in two places.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::middleware(['office:Main Office,PB', 'deny_role:Secretary'])->group(function () {
    Route::apiResource('service-requests', ServiceRequestController::class);
    Route::get('service-requests/{serviceRequest}/status', [ServiceRequestController::class, 'status']);
});
