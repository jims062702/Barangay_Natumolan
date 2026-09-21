<?php

use App\Http\Controllers\Api\Population\BhwController;
use App\Http\Controllers\Api\Population\ZoneController;
use App\Http\Controllers\Api\Health\AnimalBiteController;
use App\Http\Controllers\Api\Health\ChildHealthController;
use App\Http\Controllers\Api\Health\ImmunizationController;
use App\Http\Controllers\Api\Health\MaternalHealthController;
use App\Http\Controllers\Api\Health\PatientController;
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
    Route::post('zones', [ZoneController::class, 'store']);
    Route::put('zones/{zone}', [ZoneController::class, 'update']);
    Route::delete('zones/{zone}', [ZoneController::class, 'destroy']);
    Route::post('bhws', [BhwController::class, 'store']);
    Route::put('bhws/{bhw}', [BhwController::class, 'update']);
    Route::delete('bhws/{bhw}', [BhwController::class, 'destroy']);

    Route::get('visits', [VisitController::class, 'index']);
    Route::post('visits', [VisitController::class, 'store']);
    Route::get('patients/{resident}/history', [PatientController::class, 'history']);
    Route::get('immunization', [ImmunizationController::class, 'index']);
    Route::post('immunization', [ImmunizationController::class, 'store']);
    Route::get('immunization-status/{resident}', [ImmunizationController::class, 'status']);
    Route::get('maternal-health', [MaternalHealthController::class, 'index']);
    Route::post('maternal-health', [MaternalHealthController::class, 'store']);
    Route::get('child-health', [ChildHealthController::class, 'index']);
    Route::post('child-health', [ChildHealthController::class, 'store']);
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
    | The two running day-lists the midwife and the BHW keep by hand.
    |
    | Not case files: the pregnancy itself is in maternal-health above. These
    | are one line per visit — who came today, and what for.
    */
    Route::get('prenatal-visits', [RegisterController::class, 'prenatal']);
    Route::post('prenatal-visits', [RegisterController::class, 'storePrenatal']);
    Route::get('senior-checks', [RegisterController::class, 'seniors']);
    Route::post('senior-checks', [RegisterController::class, 'storeSenior']);

    Route::get('reports/coverage', [ReportController::class, 'coverage']);
});
