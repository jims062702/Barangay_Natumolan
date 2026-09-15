<?php

use App\Http\Controllers\Api\Admin\AccountController;
use App\Http\Controllers\Api\Admin\NonResidentController;
use Illuminate\Support\Facades\Route;

/*
| System Administration.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

/*
| System Administration — staff account management (Admin only)
*/
Route::prefix('admin')->middleware('office:AdminRole')->group(function () {
    Route::get('users', [AccountController::class, 'index']);
    Route::post('users', [AccountController::class, 'store']);
    Route::put('users/{user}', [AccountController::class, 'update']);

    /*
    | Deleting refuses cleanly when the account has work behind it —
    | see the controller. Deactivating is the answer in that case, and
    | it says so.
    */
    Route::delete('users/{user}', [AccountController::class, 'destroy']);

    /*
    | The non-residents on the REGISTER, not in the users table —
    | none of them has an account, so a list of accounts showed an
    | empty page and was technically right.
    */
    Route::get('non-residents', [NonResidentController::class, 'index']);
});
