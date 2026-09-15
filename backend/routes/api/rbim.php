<?php

use App\Http\Controllers\Api\Rbim\CensusController;
use App\Http\Controllers\Api\Rbim\LookupController;
use App\Http\Controllers\Api\Rbim\MemberMatchController;
use App\Http\Controllers\Api\Rbim\SubmissionController;
use Illuminate\Support\Facades\Route;

/*
| RBIM baseline census — the DILG household form.
|
| Collected by the BHW (Health Station) and encoded, then reviewed by the
| Population Office. The office gate is wider than the rest of the population
| module for exactly that reason; the controllers narrow reconciliation to the
| BPO itself.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

Route::get('rbim/code-lists', [LookupController::class, 'codeLists']);
// Is this house already on the register, and who is in it?
Route::get('rbim/verify-household', [LookupController::class, 'verifyHousehold']);
// Is this address free to be somebody's login?
Route::get('rbim/check-email', [LookupController::class, 'checkEmail']);
Route::get('rbim', [CensusController::class, 'index']);
Route::post('rbim', [CensusController::class, 'store']);
Route::get('rbim/{rbimCensus}', [CensusController::class, 'show']);
Route::put('rbim/{rbimCensus}', [CensusController::class, 'update']);
// Submitting is what registers the household — see the controller.
Route::post('rbim/{rbimCensus}/submit', [SubmissionController::class, 'store']);
Route::put('rbim/{rbimCensus}/members/{member}', [MemberMatchController::class, 'update']);
Route::delete('rbim/{rbimCensus}', [CensusController::class, 'destroy']);
