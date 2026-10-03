<?php

use App\Http\Controllers\Api\Public\AssistantController;
use App\Http\Controllers\Api\Public\CertificateVerificationController;
use App\Http\Controllers\Api\Public\ContactController;
use App\Http\Controllers\Api\Public\GuestAllowanceController;
use App\Http\Controllers\Api\Public\LandingController;
use App\Http\Controllers\Api\Public\ResidentIdController;
use App\Http\Controllers\Api\Public\CertificateRequestController as PublicCertificateRequestController;
use App\Http\Controllers\Api\Public\VawcReportController as PublicVawcReportController;
use App\Http\Controllers\Api\Public\ServiceDirectoryController;
use App\Http\Controllers\Api\Lupon\OnlineComplaintController;
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

Route::get('stats', [LandingController::class, 'stats']);
Route::get('verify/{referenceNumber}', [CertificateVerificationController::class, 'show']);
Route::post('assistant/inquiry', [AssistantController::class, 'ask']);

/*
| The chatbot's guest limit, counted here per internet address — not in the
| browser, where another browser on the same phone started the count again.
| See App\Services\Chat\GuestAllowance.
*/
Route::get('assistant/allowance', [GuestAllowanceController::class, 'show'])->middleware('throttle:60,1,assistant-allowance');
Route::post('assistant/allowance', [GuestAllowanceController::class, 'take'])->middleware('throttle:60,1,assistant-take');
Route::post('assistant/allowance/return', [GuestAllowanceController::class, 'giveBack'])->middleware('throttle:60,1,assistant-return');

/*
| Checking a Barangay Resident ID — the page its QR opens, and the check a
| complaint form runs on an uploaded picture of it. Valid or not, and whose
| in part; never an address or a birthday. See ResidentCards.
*/
Route::get('resident-id/{code}', [ResidentIdController::class, 'show'])
    ->where('code', '[A-Za-z0-9-]{1,40}')->middleware('throttle:120,1,public-id-show');
Route::post('resident-id/verify', [ResidentIdController::class, 'verify'])->middleware('throttle:120,1,public-id-verify');

/*
| A VAWC report sent online — by a WOMAN who is a resident, identified by her
| Barangay Resident ID. It goes to the VAW Desk's own queue, encrypted, and is
| a case only once the desk has verified it (and found the respondent on the
| register). See App\Services\Vawc\OnlineReports.
*/
Route::post('vawc/report', [PublicVawcReportController::class, 'store'])->middleware('throttle:60,1,public-vawc-report');

/*
| ONLINE CERTIFICATE REQUEST — residents only, without signing in, by their
| Barangay Resident ID. See App\Services\Portal\CertificateRequests.
*/
Route::get('certificate-request/services', [PublicCertificateRequestController::class, 'services'])->middleware('throttle:120,1,public-cert-services');
Route::post('certificate-request/check', [PublicCertificateRequestController::class, 'check'])->middleware('throttle:120,1,public-cert-check');
Route::post('certificate-request/deceased-search', [PublicCertificateRequestController::class, 'deceasedSearch'])->middleware('throttle:120,1,public-deceased-search');
Route::post('certificate-request', [PublicCertificateRequestController::class, 'store'])->middleware('throttle:60,1,public-cert-request');

Route::post('contact', [ContactController::class, 'store'])->middleware('throttle:30,1,public-contact');

/*
| BEGINNING A KP COMPLAINT FROM THE PUBLIC PAGE.
|
| This does NOT file a case. It returns an Online Complaint Reference
| Number and a status of "For Office Verification": the complainant still
| comes to the barangay, is still identified against the ID they uploaded,
| the complaint is still read, the fee is still paid, and only then does the
| Lupon accept it. What it buys is that the office has read the thing before
| the person is standing at the counter.
|
| NOT THROTTLED, by the office's decision (2026-09-25).
|
| It was three an hour per address. But a limit per address is a limit per
| NETWORK: everybody filing from the barangay hall's wifi, or from one
| household's connection, shares one address, and the fourth person would
| have been turned away for somebody else's complaint. So there is no
| ceiling. What still stands between a script and the queue is the valid
| ID every submission must carry, and the office reading each one.
|
| The cost, knowingly accepted: nothing here stops a flood, and every
| submission may carry up to 30 MB of files. If the queue or the disk is
| ever being filled deliberately, a limit goes back on this line.
*/
Route::post('complaints', [OnlineComplaintController::class, 'store']);
