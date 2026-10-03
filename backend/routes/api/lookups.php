<?php

use App\Http\Controllers\Api\Resident\OfflineSyncController;
use App\Http\Controllers\Api\Resident\ResidentController;
use App\Http\Controllers\Api\Service\CertificateCatalogueController;
use App\Http\Controllers\Api\Population\ZoneController;
use Illuminate\Support\Facades\Route;

/*
| Lookups every office uses, whatever desk it is.
|
| Loaded inside the signed-in staff group of routes/api.php, before the
| registry routes — `residents/search` must be declared ahead of
| `residents/{resident}`.
*/

/*
| Name lookup stays open to every office: VAWC, Health and the Lupon
| all need the resident picker to attach a person to their own record.
| It returns identity fields only — never the browsable registry.
*/
Route::get('residents/search', [ResidentController::class, 'search']);
Route::get('residents/{resident}/relationship/{other}', [ResidentController::class, 'relationship']);

/*
 | The register in pages, for a device that keeps working offline.
 |
 | Staff only, and deliberately inside this group: a resident has no
 | business downloading the barangay's register, and the portal
 | routes are a different group entirely.
 */
Route::get('residents/offline-sync', [OfflineSyncController::class, 'index']);

/*
 | Which certificate-number series this office owns, and where it has
 | reached — so a device with no line can carry on numbering from
 | there without ever colliding with another office.
 */
Route::get('certificates/number-series', [CertificateCatalogueController::class, 'numberSeries']);
Route::get('residents/household-options', [ResidentController::class, 'householdOptions']);

/*
 | The barangay's zones, and the BHW covering each.
 |
 | READ by every office: the registry intake, the census and the household
 | record all ask where somebody lives, and the answer has to come from one
 | list rather than from four hard-coded copies of it.
 |
 | WRITING lives in routes/api/population.php — the office that knows when a
 | zone splits is the one that may change it.
 */
Route::get('zones', [ZoneController::class, 'index']);
