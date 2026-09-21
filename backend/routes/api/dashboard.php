<?php

use App\Http\Controllers\Api\Dashboard\ExecutiveController;
use App\Http\Controllers\Api\Dashboard\SummaryController;
use App\Http\Controllers\Api\Dashboard\ConsolidatedReportController;
use Illuminate\Support\Facades\Route;

/*
| Staff dashboards.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::get('dashboard/summary', [SummaryController::class, 'summary']);
Route::get('dashboard/pending-items', [SummaryController::class, 'pendingItems']);
/*
| What residents come in for, this year. Read by the counter that issues
| these documents and by the Punong Barangay alike — so it is its own
| endpoint rather than a field inside the executive summary below, which
| carries the workload and the directives with it.
*/
Route::get('dashboard/requested-services', [SummaryController::class, 'requestedServices'])
    ->middleware('office:Main Office,PB');
/*
| The consolidated return, SEGREGATED BY DEPARTMENT.
|
| The Secretary writes the barangay's report and the Punong Barangay signs
| it, so both read all three sections. Each desk also reads its OWN — the
| VAWC desk has its own return to file and was transcribing figures off its
| screens by hand, which is where a submitted number goes wrong.
|
| Which sections a desk gets is decided in the controller from its office,
| not from the query string, so widening this gate widens nothing else.
|
| The Clerk is still out: certificates are their work, and a consolidated
| return is not a document for the counter.
*/
Route::get('reports/consolidated', [ConsolidatedReportController::class, 'show'])
    ->middleware(['office:Main Office,PB,Lupon,VAWC,Health Station', 'deny_role:Clerk']);

// Punong Barangay executive view — the whole-barangay picture.
Route::get('dashboard/executive', [ExecutiveController::class, 'show'])
    ->middleware('office:PB');
