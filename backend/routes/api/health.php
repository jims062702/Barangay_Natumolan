<?php

use App\Http\Controllers\Api\Health\AnimalBiteController;
use App\Http\Controllers\Api\Health\ChildHealthController;
use App\Http\Controllers\Api\Health\ImmunizationController;
use App\Http\Controllers\Api\Health\MaternalHealthController;
use App\Http\Controllers\Api\Health\PatientController;
use App\Http\Controllers\Api\Health\PrenatalController;
use App\Http\Controllers\Api\Health\RegisterController;
use App\Http\Controllers\Api\Health\ReportController;
use App\Http\Controllers\Api\Health\VisitController;
use Illuminate\Support\Facades\Route;

/*
| Barangay Health Station — health personnel only.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/
Route::prefix('health')->middleware('office:Health Station')->group(function () {
    /*
    | Zones and the health workers who cover them.
    |
    | MOVED HERE from the Population Office, path and all. A zone's BHW is
    | this station's own staff — they know when somebody takes over an area,
    | and the BPO learned it second-hand. Reading the list is in lookups.php,
    | because every form that asks where somebody lives needs it; only the
    | keeping of it is here.
    */

    Route::get('visits', [VisitController::class, 'index']);
    Route::post('visits', [VisitController::class, 'store']);
    Route::get('patients/{resident}/history', [PatientController::class, 'history']);
    Route::get('immunization', [ImmunizationController::class, 'index']);
    /*
    | One person's immunization record, as the ITR lays it out: read, and
    | written back whole. It replaced a one-dose-at-a-time form with a
    | Pending/Missed status the paper card has no box for.
    */
    /* Doses owed, worked out from each child's birth date and the DOH
       schedule — the card has no "due" box, so nobody types it. */
    Route::get('immunization-due', [ImmunizationController::class, 'due']);
    Route::get('immunization-card/{resident}', [ImmunizationController::class, 'card']);
    Route::put('immunization-card/{resident}', [ImmunizationController::class, 'save']);
    /*
    | Maternal Health — one record per PREGNANCY. A mother has at most one
    | current pregnancy; completing it keeps every prenatal record with it,
    | and her next one starts at 0 visits.
    */
    Route::get('maternal-health', [MaternalHealthController::class, 'index']);
    Route::post('maternal-health', [MaternalHealthController::class, 'store']);
    Route::get('maternal-health/mother/{resident}', [MaternalHealthController::class, 'forMother']);
    Route::get('maternal-health/{pregnancy}', [MaternalHealthController::class, 'show']);
    Route::put('maternal-health/{pregnancy}', [MaternalHealthController::class, 'update']);
    Route::delete('maternal-health/{pregnancy}', [MaternalHealthController::class, 'destroy']);
    Route::post('maternal-health/{pregnancy}/complete', [MaternalHealthController::class, 'complete']);
    Route::post('maternal-health/{pregnancy}/reopen', [MaternalHealthController::class, 'reopen']);

    /*
    | Prenatal Records — the station's paper register, a line per visit,
    | each belonging to a pregnancy. "Prenatal Visits" and "Visit #" are
    | counted from these, never typed.
    */
    Route::get('prenatal-visits', [PrenatalController::class, 'index']);
    Route::post('prenatal-visits', [PrenatalController::class, 'store']);
    Route::put('prenatal-visits/{visit}', [PrenatalController::class, 'update']);
    Route::delete('prenatal-visits/{visit}', [PrenatalController::class, 'destroy']);

    /*
    | Child Health & Nutrition — every weighing kept, for children on the
    | register. The mother is found first; her children are the register's,
    | and the Population Office registers a child before the station records
    | them.
    */
    Route::get('child-health', [ChildHealthController::class, 'index']);
    Route::post('child-health', [ChildHealthController::class, 'store']);
    Route::get('child-health/mother/{resident}', [ChildHealthController::class, 'mother']);
    Route::get('child-health/children/{resident}', [ChildHealthController::class, 'child']);
    Route::put('child-health/{record}', [ChildHealthController::class, 'update']);
    Route::delete('child-health/{record}', [ChildHealthController::class, 'destroy']);
    /*
    | Animal bites — a REFERRAL register and nothing more.
    |
    | The station gives no rabies series; that happens at a treatment centre.
    | What these endpoints keep is that the barangay sent them, and whether
    | anybody later found out that they went.
    */
    Route::get('animal-bites', [AnimalBiteController::class, 'index']);
    Route::post('animal-bites', [AnimalBiteController::class, 'store']);
    Route::put('animal-bites/{referral}/attendance', [AnimalBiteController::class, 'attendance']);

    /*
    | The senior-check day-list the BHW keeps by hand: one line per visit.
    */
    Route::get('senior-checks', [RegisterController::class, 'seniors']);
    Route::post('senior-checks', [RegisterController::class, 'storeSenior']);

    Route::get('reports/coverage', [ReportController::class, 'coverage']);
    Route::get('reports/summary', [ReportController::class, 'summary']);
    /* The one-page BARANGAY MONTHLY REPORT the station hands in. */
    Route::get('reports/barangay-monthly', [ReportController::class, 'barangayMonthly']);
    /* child | maternal | prenatal — monthly with ?month=, yearly without;
       ?format=csv|xlsx downloads the same report. */
    Route::get('reports/records/{kind}', [ReportController::class, 'report'])
        ->whereIn('kind', ['child', 'maternal', 'prenatal']);
});
