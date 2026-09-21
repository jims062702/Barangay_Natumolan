<?php

use App\Http\Controllers\Api\Account\AuthController;
use App\Http\Controllers\Api\Account\PasswordResetController;
use Illuminate\Support\Facades\Route;

/*
| Signing in, activating a portal account, and a forgotten password.
|
| Public: nobody who cannot sign in can be asked to be signed in first.
*/

Route::post('auth/login', [AuthController::class, 'login']);
/*
| First sign-in for a resident portal account. The account is created for
| them when they are registered, so it stays inert until they enter the code
| emailed to the address on their record. Both endpoints re-check the
| password, so neither reveals whether an address exists.
*/
Route::post('auth/activate', [AuthController::class, 'activate'])->middleware('throttle:10,1');
Route::post('auth/resend-activation', [AuthController::class, 'resendActivationCode'])->middleware('throttle:3,1');
/*
 * "The email on my account is wrong and I cannot read the code."
 *
 * The one case resending cannot solve. Unauthenticated because an account
 * that has never been activated has no token; the PASSWORD stands in for the
 * session. Throttled like the resend beside it — this one sends mail too.
 */
Route::post('auth/change-email', [AuthController::class, 'changeEmailBeforeActivation'])
    ->middleware('throttle:3,1');

/*
| A forgotten password, answered by the person's own inbox.
|
| Public, because somebody who cannot sign in cannot be asked to. Throttled
| hard for the same reason: an open endpoint that sends mail is an open
| endpoint that sends mail on somebody else's behalf.
*/
Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot'])
    ->middleware('throttle:password-reset-request');
Route::post('auth/verify-reset-code', [PasswordResetController::class, 'verify'])
    /* Guesses, so it shares the submit limiter — the real ceiling is still
       five wrong codes counted on the reset row itself. */
    ->middleware('throttle:password-reset-submit');
Route::post('auth/reset-password', [PasswordResetController::class, 'reset'])
    /* Same limiter: keyed per account, so one person mistyping cannot lock
       out a colleague on the same office connection. The real ceiling is five
       wrong codes, counted on the reset row itself. */
    ->middleware('throttle:password-reset-submit');
