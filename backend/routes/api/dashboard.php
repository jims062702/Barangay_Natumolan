<?php

use App\Http\Controllers\Api\Dashboard\ExecutiveController;
use App\Http\Controllers\Api\Dashboard\SummaryController;
use Illuminate\Support\Facades\Route;

/*
| Staff dashboards.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::get('dashboard/summary', [SummaryController::class, 'summary']);
Route::get('dashboard/pending-items', [SummaryController::class, 'pendingItems']);
// Punong Barangay executive view — the whole-barangay picture.
Route::get('dashboard/executive', [ExecutiveController::class, 'show'])
    ->middleware('office:PB');
