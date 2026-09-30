<?php

use App\Http\Controllers\Api\Resident\FamilyController;
use App\Http\Controllers\Api\Resident\GuardianshipController;
use App\Http\Controllers\Api\Resident\HouseholdIntakeController;
use App\Http\Controllers\Api\Resident\LifeStatusController;
use App\Http\Controllers\Api\Resident\MarriageController;
use App\Http\Controllers\Api\Resident\MergeController;
use App\Http\Controllers\Api\Resident\ResidentCardController;
use App\Http\Controllers\Api\Resident\ResidentController;
use App\Http\Controllers\Api\Resident\SectorController;
use Illuminate\Support\Facades\Route;

/*
| Resident registry proper — the Population Office (BPO) alone. They
| are the only office that registers a person, so they are the only
| one that browses, edits or classifies the registry. Every other
| office attaches a resident through `residents/search` above.
|
| Loaded inside the signed-in staff group of routes/api.php.
*/
Route::middleware('office:Population')->group(function () {
    /*
    | Family tree. `family/{relation}` REGISTERS a new person and
    | links them in one step (the Add parent / Add child / Add spouse
    | buttons); `family/link` connects two people who are both already
    | on the register. Declared before the apiResource so
    | `residents/{resident}/family/...` is never swallowed by it.
    */
    /*
    | Duplicate repair. Declared with the family routes because that is
    | what a split record breaks first: half the family on one copy,
    | half on the other.
    */
    Route::get('residents/{resident}/duplicates', [MergeController::class, 'duplicates']);
    Route::post('residents/{resident}/merge', [MergeController::class, 'store']);
    // Merging is a judgement call, so it has to be reversible.
    Route::get('residents/{resident}/merges', [MergeController::class, 'index']);
    Route::post('residents/{resident}/merges/{merge}/undo', [MergeController::class, 'undo']);

    /*
    | Marriage is a HISTORY: ending one records why, frees both to
    | marry again, and keeps the old row so an older certificate
    | naming a different spouse still makes sense.
    */
    /*
    | Living or deceased. Not the same as deactivating a record:
    | the family links stay, the portal login goes, and a marriage
    | ends as widowed.
    */
    Route::post('residents/{resident}/life-status', [LifeStatusController::class, 'update']);

    // A relative who lived elsewhere has moved in: convert rather
    // than re-register, so their family links come with them.
    Route::post('residents/{resident}/convert-to-resident', [LifeStatusController::class, 'convert']);

    Route::get('residents/{resident}/marriages', [MarriageController::class, 'index']);
    Route::post('residents/{resident}/marriages/{marriage}/end', [MarriageController::class, 'end']);
    Route::post('residents/{resident}/marriages/{marriage}/visibility', [MarriageController::class, 'visibility']);

    /*
    | Guardianship: who is raising a child when the parents are not.
    | Recorded on the family routes because that is where the gap
    | shows — a child registered here whose mother and father are both
    | on the register as living somewhere else.
    */
    Route::post('residents/{resident}/guardianships/{guardianship}/end', [GuardianshipController::class, 'end']);

    Route::get('residents/{resident}/family', [FamilyController::class, 'show']);
    Route::post('residents/{resident}/family/link', [FamilyController::class, 'connect']);
    Route::post('residents/{resident}/family/{relation}', [FamilyController::class, 'store'])
        ->whereIn('relation', ['parent', 'child', 'spouse', 'guardian']);
    Route::delete('residents/{resident}/family/{relative}', [FamilyController::class, 'destroy']);

    /*
    | A whole household in one submission — the shape a house-to-house
    | visit actually produces. Declared BEFORE the apiResource so
    | `residents/household` is not swallowed as `residents/{id}`.
    */
    Route::post('residents/household', [HouseholdIntakeController::class, 'store']);

    /* The Barangay Resident ID, printed at the office. A new one revokes the old. */
    Route::get('residents/{resident}/card', [ResidentCardController::class, 'show']);
    Route::post('residents/{resident}/card', [ResidentCardController::class, 'issue']);
    Route::post('residents/{resident}/card/reissue', [ResidentCardController::class, 'reissue']);
    /* Many at once — a census form's people, a household's members. */
    Route::get('resident-cards', [ResidentCardController::class, 'standing']);
    Route::post('resident-cards/bulk', [ResidentCardController::class, 'bulk']);
    Route::apiResource('residents', ResidentController::class);
    Route::post('residents/{resident}/sectors', [SectorController::class, 'store']);
    Route::delete('residents/{resident}/sectors/{sector}', [SectorController::class, 'destroy']);
});
