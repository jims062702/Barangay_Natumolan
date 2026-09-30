<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Support\ManilaTime;
use App\Http\Requests\Lupon\RegisterSettlementActionRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Settlement;
use App\Services\Lupon\SettlementActionRefused;
use App\Services\Lupon\SettlementActions;
use Illuminate\Http\Request;

/**
 * Settlements: recording the terms, and the compliance register that follows
 * them through repudiation, compliance and execution.
 */
class SettlementController extends BaseController
{
    /** 3.5 — the compliance register across every settled case. */
    public function index(Request $request)
    {
        Settlement::finaliseLapsedRepudiations();

        $query = Settlement::with(array_merge(CaseFile::WITH_PARTIES, ['recorder:id,name']));

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('settlement_type')) {
            $query->where('settlement_type', $request->settlement_type);
        }

        /* Obligations already past their compliance deadline and not closed.
           Manila's date, not the app's: `app.timezone` is UTC, so before
           8am the hall would not yet see an obligation that fell due today. */
        if ($request->boolean('due')) {
            $query->whereNotNull('compliance_deadline')
                ->whereDate('compliance_deadline', '<=', ManilaTime::today())
                ->whereIn('status', ['Final', 'Not Complied']);
        }

        return $this->success(
            $query->orderByDesc('date_agreed')->orderByDesc('id')->paginate(20),
            'Settlements retrieved'
        );
    }

    public function store(Request $request, CaseFile $case)
    {
        if ($case->settlement) {
            return $this->error('A settlement is already recorded for this case', 409);
        }

        $validated = $request->validate([
            /* One kind. An arbitration award is not something this Lupon makes. */
            'settlement_type' => 'required|in:Amicable Settlement',
            'terms' => 'required|string',
            'date_agreed' => 'required|date',
            'compliance_deadline' => 'nullable|date|after:date_agreed',
        ]);

        // KP Law: parties may repudiate within 10 days; after that it is final.
        $settlement = $case->settlement()->create($validated + [
            'repudiation_deadline' => date('Y-m-d', strtotime($validated['date_agreed'] . ' +10 days')),
            'recorded_by' => auth()->id(),
        ]);

        $case->update([
            'current_stage' => 'Settled',
            'date_resolved' => $validated['date_agreed'],
            /* The terms are why it closed; the register carries them. */
            'closure_reason' => 'Settled on ' . $validated['date_agreed'] . ': ' . $validated['terms'],
        ]);

        return $this->success($settlement, 'Settlement recorded — 10-day repudiation period started', 201);
    }

    public function caseAction(Request $request, CaseFile $case, SettlementActions $actions)
    {
        $settlement = $case->settlement;
        if (!$settlement) {
            return $this->notFound('No settlement recorded for this case');
        }

        $validated = $request->validate([
            'action' => 'required|in:' . implode(',', SettlementActions::ACTIONS),
            'notes' => 'nullable|string',
        ]);

        return $this->apply($actions, $settlement, $validated['action'], $validated['notes'] ?? null);
    }

    /**
     * 3.5 — run a compliance/execution action from the register.
     *
     * `action` is optional: omitting it records the compliance deadline and
     * notes WITHOUT advancing the status, so editing terms can never finalize
     * a settlement that is still inside its repudiation window.
     */
    public function registerAction(RegisterSettlementActionRequest $request, Settlement $settlement, SettlementActions $actions)
    {
        $validated = $request->validated();

        if (array_key_exists('compliance_deadline', $validated)) {
            $settlement->update(['compliance_deadline' => $validated['compliance_deadline']]);
        }

        if (empty($validated['action'])) {
            if (array_key_exists('notes', $validated)) {
                $settlement->update(['compliance_notes' => $validated['notes']]);
            }

            return $this->success($settlement->fresh(), 'Compliance terms updated');
        }

        return $this->apply($actions, $settlement, $validated['action'], $validated['notes'] ?? null);
    }

    private function apply(SettlementActions $actions, Settlement $settlement, string $action, ?string $notes)
    {
        try {
            return $this->success($actions->apply($settlement, $action, $notes), 'Settlement updated');
        } catch (SettlementActionRefused $refused) {
            return $this->error($refused->getMessage(), 422);
        }
    }
}
