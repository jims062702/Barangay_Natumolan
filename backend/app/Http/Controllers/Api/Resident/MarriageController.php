<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Support\ManilaTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Marriage as a history: ending one records why, and keeps the row.
 */
class MarriageController extends BaseController
{
    use GuardsRegistry;

    /**
     * Every marriage this resident has been in, most recent first.
     *
     * The ended ones matter as much as the current one: they are what explain
     * why an older certificate names a different spouse, and a widow who
     * re-marries should not have her first marriage erased to record it.
     */
    public function index(Resident $resident): JsonResponse
    {
        $rows = Marriage::involving($resident->id)
            ->with(['resident:id,first_name,middle_name,last_name,suffix,gender',
                'spouse:id,first_name,middle_name,last_name,suffix,gender',
                'deceased:id,first_name,last_name'])
            ->orderByRaw('ended_on IS NOT NULL')   // open marriage first
            ->orderByDesc('id')
            ->get()
            ->map(function ($marriage) use ($resident) {
                $partner = $marriage->partnerOf($resident->id);

                return [
                    'id' => $marriage->id,
                    'partner' => $partner?->only(['id', 'first_name', 'middle_name', 'last_name', 'suffix', 'gender']),
                    'partner_name' => $partner?->full_name,
                    'union_type' => $marriage->union_type,
                    'married_on' => $marriage->married_on?->toDateString(),
                    'ended_on' => $marriage->ended_on?->toDateString(),
                    'end_reason' => $marriage->end_reason,
                    'end_notes' => $marriage->end_notes,
                    'deceased_name' => $marriage->deceased?->full_name,
                    'shown_to_children' => $marriage->shown_to_children,
                    'is_current' => !$marriage->hasEnded(),
                ];
            });

        return $this->success($rows, 'Marriage history retrieved');
    }

    /**
     * Ends a marriage and records WHY.
     *
     * The reason is required, because it is the whole point: a resident who
     * marries again has a history the barangay has to be able to explain, and
     * "no longer married" on its own explains nothing. Ending it also frees
     * both partners to be married again, and moves their civil status to
     * match — widowed, separated, or back to single.
     */
    public function end(Request $request, Resident $resident, Marriage $marriage): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if ($marriage->resident_id !== $resident->id && $marriage->spouse_id !== $resident->id) {
            return $this->error('That marriage does not belong to this resident.', 422);
        }

        if ($marriage->hasEnded()) {
            return $this->error('That marriage has already been ended.', 409);
        }

        $validated = $request->validate([
            'end_reason' => 'required|in:' . implode(',', Marriage::END_REASONS),
            'ended_on' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'end_notes' => 'nullable|string|max:500',
            // Which partner died — required when the reason is a death, so
            // the SURVIVOR is the one marked widowed.
            'deceased_id' => 'nullable|exists:residents,id',
            // Consent: a separation is the parents' business, and only
            // appears on a child's own family view if the family agreed.
            'shown_to_children' => 'boolean',
        ]);

        $partner = $marriage->partnerOf($resident->id);

        if ($validated['end_reason'] === 'Widowed' && empty($validated['deceased_id'])) {
            return $this->error(
                'Record which partner passed away, so the other is the one marked widowed.',
                422
            );
        }

        if (!empty($validated['deceased_id'])
            && !in_array((int) $validated['deceased_id'], [$marriage->resident_id, $marriage->spouse_id], true)) {
            return $this->error('The person who passed away must be one of the two partners.', 422);
        }

        $marriage->forceFill([
            'ended_on' => $validated['ended_on'] ?? ManilaTime::today(),
            'end_reason' => $validated['end_reason'],
            'end_notes' => $validated['end_notes'] ?? null,
            'deceased_id' => $validated['deceased_id'] ?? null,
            'shown_to_children' => $request->boolean('shown_to_children'),
        ])->save();

        // Both are single again as far as the registry is concerned.
        Resident::whereIn('id', [$marriage->resident_id, $marriage->spouse_id])
            ->update(['spouse_id' => null]);

        $status = $marriage->resultingCivilStatus();

        if ($status) {
            // A death widows only the survivor; everything else applies to both.
            $affected = $marriage->deceased_id
                ? array_values(array_diff([$marriage->resident_id, $marriage->spouse_id], [$marriage->deceased_id]))
                : [$marriage->resident_id, $marriage->spouse_id];

            Resident::whereIn('id', $affected)->update(['civil_status' => $status]);
        }

        return $this->success(
            ['marriage_id' => $marriage->id],
            'Marriage to ' . ($partner?->full_name ?? 'the spouse') . ' ended ('
                . $validated['end_reason'] . ').'
                . ($status ? ' Civil status updated to ' . $status . '.' : '')
                . ' A new spouse can now be recorded.'
                /*
                 * The commonest thing to happen next, and the one most often
                 * missed: the parent left raising the children may now qualify
                 * as a Solo Parent. Said as a prompt, not done automatically —
                 * it is a registration they have to make.
                 */
                . ($marriage->resident?->children()->exists() || $marriage->spouse?->children()->exists()
                    ? ' If either parent is now raising their children alone, they may register as a'
                        . ' Solo Parent (RA 8972); add the tag once they have the ID.'
                    : '')
        );
    }

    /**
     * Turns the children's consent on or off for one marriage.
     *
     * Kept separate from ending it because consent usually arrives later —
     * the separation is recorded on the day it happens, and whether the
     * children want it on their own page is a conversation for afterwards.
     */
    public function visibility(Request $request, Resident $resident, Marriage $marriage): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if ($marriage->resident_id !== $resident->id && $marriage->spouse_id !== $resident->id) {
            return $this->error('That marriage does not belong to this resident.', 422);
        }

        $validated = $request->validate(['shown_to_children' => 'required|boolean']);

        $marriage->forceFill(['shown_to_children' => $validated['shown_to_children']])->save();

        return $this->success(null, $validated['shown_to_children']
            ? 'The children may now see how this marriage ended.'
            : 'This is hidden from the children again.');
    }
}
