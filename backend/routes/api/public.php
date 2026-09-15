<?php

use App\Http\Controllers\Api\Public\AppointmentRequestController;
use App\Http\Controllers\Api\Public\AssistantController;
use App\Http\Controllers\Api\Public\CertificateVerificationController;
use App\Http\Controllers\Api\Public\ContactController;
use App\Http\Controllers\Api\Public\LandingController;
use App\Http\Controllers\Api\Public\ServiceDirectoryController;
use Illuminate\Support\Facades\Route;

/*
| The landing page and its forms. Open to anybody, with no sign-in.
*/

Route::get('services', [ServiceDirectoryController::class, 'services']);
Route::get('contact', [ServiceDirectoryController::class, 'contact']);
Route::get('announcements', [LandingController::class, 'announcements']);
Route::get('announcements/{announcement}', [LandingController::class, 'announcement']);
Route::get('hero-slides', [LandingController::class, 'heroSlides']);
Route::get('officials', [LandingController::class, 'officials']);

/*
| An appointment asked for by somebody who is not on the register.
|
| Open to the internet, so throttled — but not as hard as it first was.
|
| A REFUSED request counts against the limit too, so at three an hour a
| visitor who mistyped their mobile number twice and corrected it was locked
| out for an hour by the form telling them off. Ten leaves room to get it
| wrong; the real protection against a spam booking is elsewhere: office
| hours, one request per number per day, and Pending rather than Scheduled.
*/
Route::post('appointment-requests', [AppointmentRequestController::class, 'store'])
    ->middleware('throttle:10,60');
Route::get('stats', [LandingController::class, 'stats']);
Route::get('verify/{referenceNumber}', [CertificateVerificationController::class, 'show']);
Route::post('assistant/inquiry', [AssistantController::class, 'ask']);

Route::post('contact', [ContactController::class, 'store'])->middleware('throttle:5,1');
