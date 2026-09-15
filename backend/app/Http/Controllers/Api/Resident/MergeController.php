<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Resident\Concerns\GuardsRegistry;
use App\Http\Controllers\Api\Resident\Concerns\RegistersResidents;
use App\Models\Resident\MergeRecord;
use App\Models\Resident\Resident;
use App\Services\Resident\RecordMerge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Duplicate repair: finding a split record, merging it, and undoing a merge.
 */
class MergeController extends BaseController
{
    use GuardsRegistry, RegistersResidents;

    /**
     * Records that look like they are already this resident — the same person
     * entered twice. Offered on the profile so a split record can be repaired
     * instead of quietly staying split.
     */
    public function duplicates(Resident $resident): JsonResponse
    {
        $candidates = $this->possibleDuplicates([
            'first_name' => $resident->first_name,
            'last_name' => $resident->last_name,
            'birthdate' => $resident->birthdate?->toDateString(),
            'mother_maiden_name' => $resident->mother_maiden_name,
        ], $resident->id);

        // What actually differs, so a clerk can decide on evidence.
        $candidates->each(function ($candidate) use ($resident) {
            $candidate->differences = $this->differencesBetween($resident, $candidate);
        });

        return $this->success($candidates, 'Possible duplicate records');
    }

    /**
     * Folds a duplicate record into this one.
     *
     * Everything the duplicate holds — certificates, requests, family links,
     * household headship, sector tags, even its portal login — moves onto
     * this record. The duplicate is deactivated, never deleted: certificates
     * issued under its number have to stay verifiable.
     */
    public function store(Request $request, Resident $resident): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        $validated = $request->validate([
            'duplicate_id' => 'required|exists:residents,id',
        ]);

        $duplicate = Resident::findOrFail($validated['duplicate_id']);

        if ($duplicate->id === $resident->id) {
            return $this->error('A record cannot be merged into itself.', 422);
        }

        if ($duplicate->merged_into_id) {
            return $this->error('That record has already been merged into another one.', 409);
        }

        if ($resident->merged_into_id) {
            return $this->error('This record was itself merged away, so nothing can be merged into it.', 409);
        }

        $result = RecordMerge::merge($resident, $duplicate);

        $movedCount = array_sum($result['moved']);

        return $this->success(
            [
                // The receipt id, so the caller can offer to undo it.
                'merge_id' => $result['record']->id,
                'moved' => $result['moved'],
                'notes' => $result['notes'],
            ],
            $duplicate->resident_number . ' was merged into ' . $resident->resident_number . '. '
                . ($movedCount > 0 ? $movedCount . ' record(s) moved across. ' : '')
                . implode(' ', $result['notes'])
                . ' This can be undone from the resident\'s profile.'
        );
    }

    /**
     * Merges this record has absorbed and can still take back.
     */
    public function index(Resident $resident): JsonResponse
    {
        $records = MergeRecord::with('duplicate:id,resident_number,first_name,middle_name,last_name,suffix,birthdate')
            ->where('keeper_id', $resident->id)
            ->whereNull('reversed_at')
            ->latest()
            ->get()
            ->map(fn ($record) => [
                'id' => $record->id,
                'duplicate' => $record->duplicate,
                'notes' => $record->notes,
                'merged_at' => $record->created_at,
                'moved_total' => collect($record->moved ?? [])
                    ->flatMap(fn ($columns) => array_map('count', $columns))->sum(),
            ]);

        return $this->success($records, 'Reversible merges');
    }

    /**
     * Takes a merge back.
     *
     * Merging is a judgement made on incomplete evidence — two people really
     * can share a name and a birthday — so the office has to be able to undo
     * one without a database restore. This replays the receipt written at
     * merge time, so records that arrived on the keeper independently
     * afterwards are left exactly where they are.
     */
    public function undo(Request $request, Resident $resident, MergeRecord $merge): JsonResponse
    {
        if (!$this->canWriteRegistry()) {
            return $this->forbidden('Your office cannot modify the resident registry');
        }

        if ($merge->keeper_id !== $resident->id) {
            return $this->error('That merge does not belong to this record.', 422);
        }

        if ($merge->isReversed()) {
            return $this->error('That merge has already been undone.', 409);
        }

        $result = RecordMerge::reverse($merge);

        return $this->success(
            $result,
            $result['duplicate']->resident_number . ' was separated out again and is active. '
                . 'Everything this merge moved has gone back to it.'
        );
    }

    /**
     * Field-by-field differences, so the decision is made on evidence rather
     * than on two names that look alike.
     */
    private function differencesBetween(Resident $a, $b): array
    {
        $fields = [
            'middle_name' => 'Middle name',
            'mother_maiden_name' => "Mother's maiden name",
            'birthdate' => 'Birthdate',
            'birth_place' => 'Place of birth',
            'gender' => 'Sex',
            'civil_status' => 'Civil status',
            'zone_purok' => 'Purok',
            'contact_number' => 'Contact',
            'email' => 'Email',
        ];

        $out = [];

        foreach ($fields as $field => $label) {
            $mine = $a->{$field} instanceof \DateTimeInterface
                ? $a->{$field}->format('Y-m-d')
                : $a->{$field};
            $theirs = $b->{$field} instanceof \DateTimeInterface
                ? $b->{$field}->format('Y-m-d')
                : $b->{$field};

            if ((string) $mine !== (string) $theirs) {
                $out[] = ['label' => $label, 'keeper' => $mine ?: null, 'duplicate' => $theirs ?: null];
            }
        }

        return $out;
    }
}
