<?php

use App\Http\Controllers\Api\Vawc\AccessLogController;
use App\Http\Controllers\Api\Vawc\AgreementController;
use App\Http\Controllers\Api\Vawc\AssessmentController;
use App\Http\Controllers\Api\Vawc\CaseController;
use App\Http\Controllers\Api\Vawc\ChildWelfareController;
use App\Http\Controllers\Api\Vawc\DocumentController;
use App\Http\Controllers\Api\Vawc\FollowupController;
use App\Http\Controllers\Api\Vawc\IncidentController;
use App\Http\Controllers\Api\Vawc\ProtectionOrderController;
use App\Http\Controllers\Api\Vawc\ReferralController;
use App\Http\Controllers\Api\Vawc\OnlineReportController;
use App\Http\Controllers\Api\Vawc\ReportController;
use Illuminate\Support\Facades\Route;

/*
| VAWC Desk — STRICTLY isolated: office VAWC only.
|
| Loaded inside the signed-in staff group of routes/api.php.
|
| The desk-wide lists span every case so the officer can work by task
| (referrals owed a response, follow-ups due) instead of opening cases one
| at a time. They carry the case CODE only — never the survivor's name.
| Opening the case itself is what writes a `viewed` entry to the trail.
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

    /*
    | The ONE dialogue this case may have, and whether it ended in agreement.
    |
    | Saving again edits that record — the table's unique key makes a second
    | sitting impossible. A VAWC matter is not mediated in a series, and a
    | desk that could book a second sitting has started doing exactly that.
    | Optional: a case may go straight to a protection order.
    */
    Route::get('cases/{case}/agreement', [AgreementController::class, 'show']);
    Route::post('cases/{case}/agreement', [AgreementController::class, 'store']);

    /* Barangay Protection Orders: applied for, issued, renewed — 15 days each. */
    Route::post('cases/{case}/protection-orders', [ProtectionOrderController::class, 'store']);
    Route::put('cases/{case}/protection-orders/{order}', [ProtectionOrderController::class, 'update']);

    /* The case assessment & action plan, and child & dependent welfare — one each. */
    Route::post('cases/{case}/assessment', [AssessmentController::class, 'store']);
    Route::post('cases/{case}/child-welfare', [ChildWelfareController::class, 'store']);
    Route::post('cases/{case}/incidents', [IncidentController::class, 'store']);
    Route::post('cases/{case}/referrals', [ReferralController::class, 'store']);
    Route::put('cases/{case}/referrals/{referral}', [ReferralController::class, 'update']);
    Route::post('cases/{case}/followup', [FollowupController::class, 'store']);
    Route::get('cases/{case}/documents', [DocumentController::class, 'forCase']);
    Route::post('cases/{case}/documents', [DocumentController::class, 'store']);
    Route::get('cases/{case}/access-logs', [AccessLogController::class, 'forCase']);
    Route::get('reports/statistics', [ReportController::class, 'statistics']);
    /* The printed forms: VAW-C Cases (names — logged per case), VAW Form 1,
       and the Annual Accomplishment Report (counts only). */
    Route::get('reports/cases', [ReportController::class, 'casesReport']);
    Route::get('reports/data-capture', [ReportController::class, 'dataCapture']);
    Route::get('reports/annual', [ReportController::class, 'annual']);

    /* Reports residents sent online: read (and logged), verified, or declined. */
    Route::get('online-reports', [OnlineReportController::class, 'index']);
    Route::get('online-reports/{report}', [OnlineReportController::class, 'show']);
    Route::get('online-reports/{report}/id', [OnlineReportController::class, 'validId']);
    Route::post('online-reports/{report}/accept', [OnlineReportController::class, 'accept']);
    Route::post('online-reports/{report}/decline', [OnlineReportController::class, 'decline']);
});
