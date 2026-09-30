<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\RecordConciliationRequest;
use App\Http\Requests\Lupon\RecordMediationRequest;
use App\Models\Lupon\CaseFile;
use App\Support\ManilaTime;

/**
 * The two proceedings a dispute passes through: mediation by the Punong
 * Barangay, and conciliation before the Pangkat when mediation fails.
 */
class ProceedingController extends BaseController
{
    public function mediation(RecordMediationRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        $case->hearings()->create([
            'hearing_type' => 'Mediation',
            'scheduled_at' => $validated['mediation_date'],
            'status' => 'Completed',
            'attendance_notes' => $validated['attendance'],
            'proceedings_notes' => $validated['proceedings_notes'] ?? null,
            'outcome' => $validated['outcome'],
            'recorded_by' => auth()->id(),
        ]);

        // Mediation by the Punong Barangay; if it fails, the Pangkat conciliates.
        if ($validated['outcome'] === 'Settlement Reached') {
            $case->update(['current_stage' => 'Settled']);
        } elseif ($validated['outcome'] === 'No Settlement') {
            $case->update(['current_stage' => 'Conciliation']);
        }

        return $this->success($case->fresh(), 'Mediation recorded');
    }

    public function conciliation(RecordConciliationRequest $request, CaseFile $case)
    {
        $validated = $request->validated();

        $case->hearings()->create([
            'hearing_type' => 'Conciliation',
            'scheduled_at' => $validated['conciliation_date'],
            'status' => 'Completed',
            'attendance_notes' => 'Pangkat: ' . implode(', ', $validated['pangkat_members']),
            'proceedings_notes' => $validated['proceedings_notes'] ?? null,
            'outcome' => $validated['outcome'],
            'recorded_by' => auth()->id(),
        ]);

        if ($validated['outcome'] === 'Settlement') {
            $case->update([
                'current_stage' => 'Settled',
                /* Every closed case carries the words that closed it. */
                'closure_reason' => $validated['proceedings_notes']
                    ?: 'Settled before the Pangkat on ' . $validated['conciliation_date'] . '.',
            ]);
        } else {
            /* Dismissed. There is no arbitration branch: a matter this Lupon
               cannot settle is closed here, not escalated into a stage the
               barangay has no power to run.

               The minutes ARE the reason, and the form now insists on them:
               "Dismissed" with nothing beside it is a case nobody can
               explain to the complainant who comes back asking. */
            $case->update([
                'current_stage' => 'Dismissed',
                'date_resolved' => ManilaTime::today(),
                'closure_reason' => $validated['proceedings_notes'],
            ]);
        }

        return $this->success($case->fresh(), 'Conciliation recorded');
    }
}
