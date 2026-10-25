<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\Agreement;
use App\Models\Vawc\CaseFile;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The one dialogue a VAWC case may have, and how it ended.
 *
 * ONCE. The desk may sit the parties down one time; that one sitting shows
 * whether they reach an agreement. Saving again edits that record rather
 * than opening a second sitting — a VAWC matter is not mediated in a series.
 *
 * OPTIONAL. Many cases never have one and go straight to a Barangay
 * Protection Order, and nothing on the BPO side ever asks whether a dialogue
 * happened (RA 9262 §33).
 *
 * The record is encrypted at rest and stays at this desk: it is never cached
 * on a device, never queued offline, and never travels in a consolidated
 * report.
 */
class AgreementController extends BaseController
{
    public function show(CaseFile $case)
    {
        return $this->success(
            $case->agreement()->with('recorder:id,name')->first(),
            'Dialogue retrieved'
        );
    }

    /**
     * Records the dialogue, or corrects the one already recorded.
     *
     * updateOrCreate rather than create: the unique key on the table means a
     * second one cannot exist, and a clerk who reopens the form to fix a date
     * should get an edit, not a constraint violation they cannot read.
     */
    public function store(Request $request, CaseFile $case)
    {
        $validated = $request->validate([
            'session_date' => ['required', 'date', 'before_or_equal:' . ManilaTime::today()],
            'attendees' => ['nullable', 'string', 'max:500'],
            'discussion' => ['required', 'string'],
            'outcome' => ['required', Rule::in(Agreement::OUTCOMES)],
            'agreement' => ['nullable', 'string', 'required_if:outcome,Agreement reached'],
            'close_case' => ['nullable', 'boolean'],
        ], [
            'session_date.before_or_equal' => 'A dialogue cannot be recorded for a future date.',
            'discussion.required' => 'Write what was discussed at the dialogue.',
            'outcome.required' => 'Say whether the parties reached an agreement or not settled.',
            'agreement.required_if' => 'Write what the parties agreed to.',
        ]);

        /* Not settled / No agreement: nothing agreed — terms cleared. */
        if (in_array($validated['outcome'], ['Not settled', 'No agreement'], true)) {
            $validated['agreement'] = null;
        }

        $closeCase = !empty($validated['close_case']);
        unset($validated['close_case']);

        $agreement = Agreement::updateOrCreate(
            ['vawc_case_id' => $case->id],
            $validated + ['recorded_by' => auth()->id()]
        );

        AccessLog::record(
            $case->id,
            $agreement->wasRecentlyCreated ? 'dialogue_recorded' : 'dialogue_updated',
            $validated['outcome']
        );

        if ($closeCase && $case->status === 'Active') {
            $case->update([
                'status' => 'Closed',
                'closed_at' => now(),
            ]);
            AccessLog::record(
                $case->id,
                'case_closed',
                "Case closed following dialogue ({$validated['outcome']})"
            );
        }

        return $this->success(
            $agreement->fresh()->load('recorder:id,name'),
            $agreement->wasRecentlyCreated
                ? ($closeCase ? 'Dialogue recorded and case closed.' : 'Dialogue recorded.')
                : ($closeCase ? 'Dialogue updated and case closed.' : 'The dialogue record was updated.')
        );
    }
}
