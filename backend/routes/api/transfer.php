<?php

use App\Http\Controllers\Api\Resident\TransferController;
use Illuminate\Support\Facades\Route;

/*
| Getting the register in and out as a spreadsheet.
|
| Preview before import, always: the office is handing the system a file
| from somewhere else, and the preview is the only chance anybody gets to
| look before four hundred records change.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::get('residents-export', [TransferController::class, 'export']);
Route::get('residents-import/template', [TransferController::class, 'template']);
Route::post('residents-import/preview', [TransferController::class, 'preview']);
Route::post('residents-import', [TransferController::class, 'import']);
