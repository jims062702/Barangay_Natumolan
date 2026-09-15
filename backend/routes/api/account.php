<?php

use App\Http\Controllers\Api\Account\AuthController;
use App\Http\Controllers\Api\Account\NotificationController;
use App\Http\Controllers\Api\Account\PasswordChangeController;
use Illuminate\Support\Facades\Route;

/*
| The signed-in account, staff and residents alike.
|
| Loaded inside the auth:sanctum group of routes/api.php.
*/

Route::prefix('auth')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::put('profile', [AuthController::class, 'updateProfile']);
    Route::post('change-password', [AuthController::class, 'changePassword']);

    /*
     * The same job, done properly: the current password AND a code to the
     * account's own mailbox. The portal uses this one. The route above
     * stays until the offices have addresses that can receive email —
     * see the note in PasswordChangeController.
     */
    Route::post('password-change/code', [PasswordChangeController::class, 'requestCode'])
        ->middleware('throttle:password-reset-request');
    Route::post('password-change', [PasswordChangeController::class, 'change'])
        ->middleware('throttle:password-reset-submit');
    Route::post('refresh-token', [AuthController::class, 'refreshToken']);
});

// In-system notifications (staff + residents, self-scoped)
Route::get('notifications', [NotificationController::class, 'index']);
Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);
