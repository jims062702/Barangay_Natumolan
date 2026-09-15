<?php

namespace App\Services\Lupon;

use App\Models\Lupon\Settlement;

/**
 * The compliance/execution state machine, shared by the per-case screen
 * and the desk-wide settlement register.
 */
final class SettlementActions
{
    /** Compliance/execution transitions available on a recorded settlement. */
    public const ACTIONS = [
        'finalize', 'repudiate', 'mark_complied', 'mark_not_complied',
        'execute', 'issue_cfa', 'issue_cba',
    ];

    /**
     * @throws SettlementActionRefused when the repudiation period has lapsed
     */
    public function apply(Settlement $settlement, string $action, ?string $notes): Settlement
    {
        $case = $settlement->luponCase;

        switch ($action) {
            case 'finalize':
                $settlement->update(['status' => 'Final']);
                break;
            case 'repudiate':
                if (today()->gt($settlement->repudiation_deadline)) {
                    throw new SettlementActionRefused('Repudiation period has lapsed — settlement is final');
                }
                $settlement->update(['status' => 'Repudiated']);
                $case?->update(['current_stage' => 'Conciliation']);
                break;
            case 'mark_complied':
                $settlement->update(['status' => 'Complied', 'compliance_notes' => $notes, 'closed_at' => now()]);
                break;
            case 'mark_not_complied':
                $settlement->update(['status' => 'Not Complied', 'compliance_notes' => $notes]);
                break;
            case 'execute':
                $settlement->update(['status' => 'Executed', 'compliance_notes' => $notes]);
                break;
            case 'issue_cfa':
                $settlement->update(['cfa_issued' => true, 'cfa_issued_at' => now()]);
                $case?->update(['current_stage' => 'Referred', 'notes' => 'Certificate to File Action issued']);
                break;
            case 'issue_cba':
                $settlement->update(['cba_issued' => true, 'cba_issued_at' => now()]);
                break;
        }

        return $settlement->fresh();
    }
}
