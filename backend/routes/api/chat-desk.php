<?php

use App\Http\Controllers\Api\Chat\DeskController;
use Illuminate\Support\Facades\Route;

/*
| Live-agent chat desk. The CLERK alone answers it: the Secretary and
| the Punong Barangay are refused, since the desk is the service
| counter's (2026-09-30).
|
| Loaded inside the signed-in staff group of routes/api.php.
*/
/* The Clerk answers it: the person asked "how do I get a clearance?"
   should be the one who issues it. Main Office's other two roles are
   turned away by name, which leaves the Clerk. */
Route::prefix('chat')->middleware(['office:Main Office', 'deny_role:Secretary,Punong Barangay'])->group(function () {
    // The canned answers the composer offers behind @certificate/… and
    // @officials/…, built from the guides and roster the office keeps.
    Route::get('shortcuts', [DeskController::class, 'shortcuts']);
    Route::get('queue/count', [DeskController::class, 'waitingCount']);
    Route::get('conversations', [DeskController::class, 'conversations']);
    Route::get('conversations/{conversation}', [DeskController::class, 'show']);
    Route::post('conversations/{conversation}/claim', [DeskController::class, 'claim']);
    Route::post('conversations/{conversation}/reply', [DeskController::class, 'reply']);
    Route::post('conversations/{conversation}/close', [DeskController::class, 'close']);
});
