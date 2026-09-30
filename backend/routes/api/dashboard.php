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
| The consolidated return — the SECRETARY'S and the PUNONG BARANGAY'S.
|
| It gathers every office's figures (Lupon, VAWC, Health, Population, the
| Clerk's certificates) because those two answer for the barangay as a whole.
| No desk opens it; each keeps its own report. The Clerk is Main Office too,
| so is turned away by role.
*/
Route::get('reports/consolidated', [ConsolidatedReportController::class, 'show'])
    ->middleware(['office:Main Office,PB', 'deny_role:Clerk']);

/*
| An office's OWN report, built from the same figures as its section of the
| consolidated return so the two cannot disagree. For the offices that had
| no report page: Health and Population.
*/
Route::get('reports/office', [ConsolidatedReportController::class, 'office'])
    ->middleware('office:Health Station,Population');

// Punong Barangay executive view — the whole-barangay picture.
Route::get('dashboard/executive', [ExecutiveController::class, 'show'])
    ->middleware('office:PB');
