<?php

namespace App\Services\Lupon;

use App\Models\Lupon\Settlement;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * The compliance/execution state machine, shared by the per-case screen
 * and the desk-wide settlement register.
 */
final class SettlementActions
{
    /** Compliance/execution transitions available on a recorded settlement. */
    public const ACTIONS = [
        'finalize', 'repudiate', 'mark_complied', 'mark_not_complied',
        /* No issue_cfa or issue_cba: neither document is issued here
           any more, and the columns they wrote to are dropped. */
        'execute',
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
                /*
                 * MANILA'S DATE DECIDES, not the app's.
                 *
                 * `app.timezone` is UTC and runs eight hours behind the
                 * hall, so between midnight and 8am Manila this read
                 * yesterday — and a settlement whose ten days had lapsed
                 * could still be repudiated that morning. The window the
                 * KP law gives is counted in the barangay's own days.
                 */
                if (Carbon::parse(ManilaTime::today())->gt($settlement->repudiation_deadline)) {
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
        }

        return $settlement->fresh();
    }
}
