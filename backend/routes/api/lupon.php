<?php

use App\Http\Controllers\Api\Lupon\CaseController;
use App\Http\Controllers\Api\Lupon\ClosureController;
use App\Http\Controllers\Api\Lupon\HearingController;
use App\Http\Controllers\Api\Lupon\ProceedingController;
use App\Http\Controllers\Api\Lupon\OnlineComplaintController;
use App\Http\Controllers\Api\Lupon\PaymentController;
use App\Http\Controllers\Api\Lupon\ReportController;
use App\Http\Controllers\Api\Lupon\ScheduleController;
use App\Http\Controllers\Api\Lupon\SettlementController;
use App\Http\Controllers\Api\Lupon\SummonsController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Lupon Tagapamayapa
|--------------------------------------------------------------------------
| Loaded inside the signed-in staff group of routes/api.php, so every route
| here already requires a staff session. The docket is the Lupon office's and
| the Punong Barangay's.
*/

/*
| The hearing calendar, and only that.
|
| The barangay secretary takes the minutes at a mediation, so they
| reach the hearings — but not the cases behind them, not the
| settlements and not the reports. Widening the whole Lupon gate to
| give them a calendar would hand over the docket with it.
|
| The Clerk is kept out: certificates are their work, not the KP's.
*/
Route::prefix('lupon')
    ->middleware(['office:Lupon,PB,Main Office', 'deny_role:Clerk'])
    ->group(function () {
        Route::get('hearings', [HearingController::class, 'index']);
        /*
        | What has been FORWARDED to this desk and is waiting on a summons.
        |
        | The list the office was missing. The fee is confirmed at the Lupon
        | and the case goes to the Barangay Secretary; the three Tuesdays are
        | spent and it goes to the Lupon. Neither hand-off could be seen
        | before, because a case waiting on a summons had no sitting to show
        | up on a calendar.
        */
        Route::get('awaiting-summons', [SummonsController::class, 'awaiting']);
        /*
        | A MONTH OF THE PUNONG BARANGAY'S SITTINGS, laid out as a calendar.
        |
        | The Punong Barangay presides and records nothing, so a paginated
        | table with an Actions column is the wrong shape for them: what
        | they need is which days the hall sits, at what hour, and who is
        | coming. The Lupon reads it too — a case on its third Tuesday is
        | about to land on their desk.
        */
        Route::get('hearing-calendar', [HearingController::class, 'calendar']);
        /* Printing the summons is what books the sittings — the Secretary's
           three Tuesdays, or the Lupon's three Thursdays. */
        /* The sittings the papers would book — the papers print from it, BEFORE anything is booked. */
        Route::get('cases/{case}/summons-plan', [SummonsController::class, 'plan']);
        Route::post('cases/{case}/summons', [SummonsController::class, 'issue']);
        /* The room's other two lists: withdrawn cases, and cases certified
           to court. Cases, but only what the hearing room needs of them. */
        Route::get('hearing-cases', [HearingController::class, 'closedCases']);
        /* One sitting, with the complaint behind it — the screen the
           minutes are taken on. */
        Route::get('hearings/{hearing}', [HearingController::class, 'show']);
        Route::put('hearings/{hearing}', [HearingController::class, 'update']);
        Route::post('hearings/{hearing}/summons', [HearingController::class, 'recordSummons']);
        /*
        | The Secretary prints the summons — and that is when the parties are
        | told the schedule and the case reaches their Lupon Records.
        */
        Route::post('hearings/{hearing}/summons-printed', [HearingController::class, 'printSummons']);
        /* The sitting itself: the minutes, and which of the two endings
           it reached. An agreement settles and closes the case here. */
        Route::post('hearings/{hearing}/session', [HearingController::class, 'session']);
        /*
        | The HOUR of a sitting, moved by the desk that works it.
        |
        | Ten cases on one Tuesday do not fit six ninety-minute slots
        | between eight and five, so the arithmetic hands out hours past
        | closing and the office puts them right. The DAY does not move:
        | the summons in a party's hand names it.
        */
        Route::post('hearings/{hearing}/start-time', [HearingController::class, 'startTime']);
        /*
        | The case as the hearing room needs to read it.
        |
        | The Secretary writes the minutes and has no docket: the case
        | number on every row linked to one and answered 403 to the one
        | officer whose job is to record what happened. Read-only, and the
        | docket — filing, the fee, the certificate — stays with the Lupon.
        */
        Route::get('hearing-cases/{case}', [HearingController::class, 'caseFile']);
        /*
        | THERE IS NO CANCEL AND NO RESCHEDULE.
        |
        | The barangay sits on fixed days and gives the parties three of
        | them. A sitting moved or called off is a party who came to the
        | hall for nothing, or who stayed away on a date that still stood,
        | and the summons already in their hands names the day. If the hall
        | cannot sit, the sitting is recorded as unsettled and the next one
        | stands — the calendar does not bend.
        |
        | Sittings ARE still stood down, by the system and never by hand:
        | when a case settles, is withdrawn or is certified to court, the
        | days nobody will attend come off with it (HearingCalendar).
        */
        /* The complainant takes the complaint back: the case closes and the
           calendar is stood down. Withdrawing is done from the room the
           parties are standing in, so the Secretary can do it. */
        Route::post('cases/{case}/withdraw', [ClosureController::class, 'withdraw']);
        /* The one action that CLOSES a case at the table: the parties
           agreed. Kept for the case screen; the hearing session does the
           same thing from the room. */
        Route::post('hearings/{hearing}/settle', [ScheduleController::class, 'settleAtHearing']);
        /*
        | The prescribed KP forms, and the summons among them.
        |
        | HERE, not with the docket: the Barangay Secretary is the officer
        | who prints the summons, and a Print button that answered 403 was
        | a paper the office could not produce. It reads one case and
        | writes nothing.
        */
        Route::get('cases/{case}/forms', [ReportController::class, 'forms']);
    });

Route::prefix('lupon')->middleware('office:Lupon,PB')->group(function () {
    Route::get('deadlines', [ReportController::class, 'deadlines']);
    Route::get('reports/monthly-transmittal', [ReportController::class, 'monthlyTransmittal']);
    /* The barangay's own list of what was filed this month, by status. */
    Route::get('reports/cases-filed', [ReportController::class, 'casesFiled']);

    // The compliance register, spanning the whole docket.
    // (The hearing calendar sits in its own group above — the
    // barangay secretary minutes those hearings without being given
    // the docket they belong to.)
    Route::get('settlements', [SettlementController::class, 'index']);
    Route::post('settlements/{settlement}/action', [SettlementController::class, 'registerAction']);
    /*
    | COMPLAINTS BEGUN ONLINE, and the one press that turns one into a case.
    |
    | Everything before `accept` is a queue: the office reads the complaint
    | and looks at the uploaded ID before the person arrives. `accept` is
    | pressed at the counter with the complainant in front of them, and it
    | is the only moment a reference number (OC-2026-0007) becomes a case
    | number. The Population Office's own waiting list hangs off the same
    | controller, because it is the same submission seen from their side.
    */
    Route::get('online-complaints', [OnlineComplaintController::class, 'index']);
    Route::get('online-complaints/{complaint}/valid-id', [OnlineComplaintController::class, 'validId']);
    Route::post('online-complaints/{complaint}/accept', [OnlineComplaintController::class, 'accept']);
    Route::post('online-complaints/{complaint}/reject', [OnlineComplaintController::class, 'reject']);

    Route::get('cases', [CaseController::class, 'index']);
    Route::post('cases', [CaseController::class, 'store']);
    Route::get('cases/{case}', [CaseController::class, 'show']);
    /* Only for a case with no respondent yet — see CaseController::nameRespondents(). */
    Route::post('cases/{case}/respondents', [CaseController::class, 'nameRespondents']);
    Route::post('cases/{case}/hearings', [HearingController::class, 'store']);
    Route::put('cases/{case}/hearings/{hearing}', [HearingController::class, 'recordOutcome']);
    Route::post('cases/{case}/mediation', [ProceedingController::class, 'mediation']);
    Route::post('cases/{case}/conciliation', [ProceedingController::class, 'conciliation']);
    Route::post('cases/{case}/settlement', [SettlementController::class, 'store']);
    Route::post('cases/{case}/settlement-action', [SettlementController::class, 'caseAction']);
    /*
    | THERE IS NO "ISSUE SUMMONS" AND NO "SEND TO THE LUPON" ROUTE.
    |
    | Both were one office pressing a button that decided something the
    | calendar now decides for itself. The summons is printed from the
    | hearing room and the printing books the sittings; a case leaves the
    | Punong Barangay when the third Tuesday is spent, not when somebody
    | judges that it should. The barangay gives the parties three sittings
    | and they are entitled to all three.
    */

    /*
     * The filing fee: Paid, pressed by the Lupon on sight of the official
     * receipt — and undone, for a mis-click, until the summons goes out.
     * No other office takes part and no money passes through any desk.
     */
    Route::post('cases/{case}/filing-fee/paid', [PaymentController::class, 'paid']);
    Route::post('cases/{case}/filing-fee/undo', [PaymentController::class, 'undo']);
});

/*
| THE CERTIFICATE TO FILE ACTION IS THE LUPON'S ALONE.
|
| Not the Punong Barangay's, though they sat the mediation, and not the
| Secretary's, though they keep the record: the certificate says the Lupon
| tried and failed to conciliate the dispute, so the officer who signs it is
| the officer whose own sittings it describes. `office:Lupon` and nothing
| else — the group above would have let the Punong Barangay certify their
| own mediation, which is not a thing the certificate can say.
*/
Route::prefix('lupon')->middleware('office:Lupon')->group(function () {
    Route::post('cases/{case}/cfa', [ClosureController::class, 'certifyToFileAction']);
});

/*
| No Clerk's counter for Lupon fees any more: the Lupon confirms the receipt
| itself (above), and the Main Office handles no part of it.
*/
