<?php

use App\Http\Controllers\Api\Content\AnnouncementController;
use App\Http\Controllers\Api\Content\HeroSlideController;
use App\Http\Controllers\Api\Council\OfficialController;
use Illuminate\Support\Facades\Route;

/*
| The public landing content the SK office keeps: pictures, posts, officials.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/

/*
| Sangguniang Kabataan (SK) — manages the public landing content:
| home pictures, news & announcements, and officials.
*/
Route::prefix('sk')->middleware('office:SK,PB,AdminRole')->group(function () {
    Route::post('hero-slides/reorder', [HeroSlideController::class, 'reorder']);
    Route::apiResource('hero-slides', HeroSlideController::class)
        ->only(['index', 'store', 'update', 'destroy']);
    Route::apiResource('officials', OfficialController::class)
        ->only(['index', 'store', 'update', 'destroy']);
    Route::post('announcements/reorder', [AnnouncementController::class, 'reorder']);
    Route::apiResource('announcements', AnnouncementController::class)
        ->only(['index', 'store', 'update', 'destroy']);
});
