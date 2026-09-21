<?php

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

Route::get('stats', [LandingController::class, 'stats']);
Route::get('verify/{referenceNumber}', [CertificateVerificationController::class, 'show']);
Route::post('assistant/inquiry', [AssistantController::class, 'ask']);

Route::post('contact', [ContactController::class, 'store'])->middleware('throttle:5,1');
