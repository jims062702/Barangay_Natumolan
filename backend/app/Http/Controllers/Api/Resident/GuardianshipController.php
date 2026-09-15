<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Models\Resident\Guardianship;
use App\Models\Resident\Resident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ending a guardianship that came to an end — the row is kept.
 */
class GuardianshipController extends BaseController
{
    use GuardsRegistry;

    /**
     * Ends a guardianship — the parents came home, the child turned 18.
     *
     * Ending rather than deleting. The row is the answer to "who was raising
     * this child in 2026?", which is asked long after the arrangement is over.
     */
    public function end(Request $request, Resident $resident, Guardianship $guardianship): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if ($guardianship->ward_id !== $resident->id) {
            return $this->error('That guardianship is not on this resident\'s record.', 404);
        }

        if ($guardianship->ended_on) {
            return $this->error('That guardianship has already ended.', 409);
        }

        $validated = $request->validate([
            'ended_on' => 'nullable|date|before_or_equal:today',
            'end_reason' => 'required|in:' . implode(',', Guardianship::END_REASONS),
            'note' => 'nullable|string|max:255',
        ]);

        $guardianship->update([
            'ended_on' => $validated['ended_on'] ?? now()->toDateString(),
            'end_reason' => $validated['end_reason'],
            'note' => $validated['note'] ?? $guardianship->note,
        ]);

        $guardianship->load('guardian');

        return $this->success(
            null,
            ($guardianship->guardian?->full_name ?? 'The guardian')
                . ' is no longer recorded as raising ' . $resident->first_name
                . ' — ' . lcfirst($validated['end_reason']) . '.'
        );
    }
}
