<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Models\Resident\Resident;
use App\Models\Resident\Sector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The sector tags on one resident — PWD, Solo Parent, 4Ps and the rest.
 */
class SectorController extends BaseController
{
    use GuardsRegistry;

    /**
     * Add resident to sector
     */
    public function store(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $validated = $request->validate([
            'sector_type' => 'required|string',
            'enrolled_date' => 'nullable|date',
            // The Solo Parent ID / PWD ID / 4Ps household number behind the tag.
            'reference_no' => 'nullable|string|max:60',
            'issued_on' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'note' => 'nullable|string|max:255',
        ]);

        /*
         * Solo Parent is a STATUS under RA 8972, granted on registration and
         * carrying benefits — not something a clerk concludes from looking at
         * a household. Two things follow, and the register enforces both.
         */
        if ($validated['sector_type'] === 'Solo Parent') {
            // Someone with a partner on record is not raising children alone.
            if ($resident->spouse_id) {
                return $this->error(
                    $resident->full_name . ' is recorded as partnered with '
                        . ($resident->spouse?->full_name ?? 'someone')
                        . ', so they cannot be tagged Solo Parent. If that union has ended, '
                        . 'end it on their record first — with the reason — and the tag can '
                        . 'then be added.',
                    409
                );
            }

            // And the tag follows the ID, not the other way round.
            if (empty($validated['reference_no'])) {
                return $this->error(
                    'A Solo Parent ID or registration reference is required. Solo Parent is a '
                        . 'registration under RA 8972 — record the number from their ID, or '
                        . 'have them register first.',
                    422
                );
            }
        }

        // Age brackets are derived from birthdate — never assigned by hand.
        if (in_array($validated['sector_type'], Resident::AGE_SECTORS, true)) {
            return $this->error('Age brackets (Child, Youth, Adult, Senior Citizen) are set automatically from birthdate and cannot be added manually.', 422);
        }

        // A resident can only hold one row per sector_type (unique index), so
        // reactivate a soft-removed one instead of erroring on a duplicate.
        $existing = $resident->sectors()->where('sector_type', $validated['sector_type'])->first();
        if ($existing) {
            $existing->update($validated + ['is_active' => true, 'unenrolled_date' => null]);
        } else {
            $resident->sectors()->create($validated);
        }

        return $this->success(null, 'Resident added to sector successfully', 201);
    }

    /**
     * Remove a sector tag from a resident. Age-based tags (Child, Youth, Adult,
     * Senior) will be re-derived on the next `residents:sync-sectors` run.
     */
    public function destroy(Resident $resident, Sector $sector): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if ($sector->resident_id !== $resident->id) {
            return $this->error('That sector tag does not belong to this resident', 422);
        }

        // Age brackets are auto-managed and re-derive on view; block manual removal.
        if (in_array($sector->sector_type, Resident::AGE_SECTORS, true)) {
            return $this->error('Age brackets are set automatically from birthdate and cannot be removed.', 422);
        }

        $sector->delete();

        return $this->success(null, 'Sector removed');
    }
}
