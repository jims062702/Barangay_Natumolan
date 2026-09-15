<?php

use App\Http\Controllers\Api\Chat\DeskController;
use Illuminate\Support\Facades\Route;

/*
| The live chat desk.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

/*
| Live-agent chat desk. The SECRETARY is responsible for it, with the
| Punong Barangay and Admin able to step in; the Clerk is excluded,
| since their remit is the service counter.
*/
Route::prefix('chat')->middleware(['office:Main Office,PB', 'deny_role:Clerk'])->group(function () {
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
