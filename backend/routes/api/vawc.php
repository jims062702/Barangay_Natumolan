<?php

use App\Http\Controllers\Api\Vawc\AccessLogController;
use App\Http\Controllers\Api\Vawc\CaseController;
use App\Http\Controllers\Api\Vawc\DocumentController;
use App\Http\Controllers\Api\Vawc\FollowupController;
use App\Http\Controllers\Api\Vawc\IncidentController;
use App\Http\Controllers\Api\Vawc\ReferralController;
use App\Http\Controllers\Api\Vawc\ReportController;
use Illuminate\Support\Facades\Route;

/*
| VAWC Desk
|
| Loaded inside the signed-in staff group of routes/api.php.
|
| The desk-wide lists span every case so the officer can work by task
| (referrals owed a response, follow-ups due) instead of opening cases one
| at a time. They carry the case CODE only — never the survivor's name.
| Opening the case itself is what writes a `viewed` entry to the trail.
*/

/*
| VAWC Desk — STRICTLY isolated: office VAWC only.
*/
Route::prefix('vawc')->middleware('office:VAWC')->group(function () {
    // Desk-wide worklists (case codes only — never survivor names).
    Route::get('referrals', [ReferralController::class, 'index']);
    Route::put('referrals/{referral}', [ReferralController::class, 'updateFromDesk']);
    Route::get('followups', [FollowupController::class, 'index']);
    Route::get('documents', [DocumentController::class, 'index']);
    Route::put('documents/{document}', [DocumentController::class, 'update']);
    Route::get('access-logs', [AccessLogController::class, 'index']);

    Route::get('cases', [CaseController::class, 'index']);
    Route::post('cases', [CaseController::class, 'store']);
    Route::get('cases/{case}', [CaseController::class, 'show']);
    Route::put('cases/{case}', [CaseController::class, 'update']);
    Route::post('cases/{case}/incidents', [IncidentController::class, 'store']);
    Route::post('cases/{case}/referrals', [ReferralController::class, 'store']);
    Route::put('cases/{case}/referrals/{referral}', [ReferralController::class, 'update']);
    Route::post('cases/{case}/followup', [FollowupController::class, 'store']);
    Route::get('cases/{case}/documents', [DocumentController::class, 'forCase']);
    Route::post('cases/{case}/documents', [DocumentController::class, 'store']);
    Route::get('cases/{case}/access-logs', [AccessLogController::class, 'forCase']);
    Route::get('reports/statistics', [ReportController::class, 'statistics']);
});
