<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\Agreement;
use App\Models\Vawc\CaseFile;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * The session a VAWC case gets, and the agreement that came out of it.
 *
 * ONE SESSION. The desk sits the parties down once to hear what happened and
 * write down what was agreed. Saving again edits that record rather than
 * opening a second sitting — a VAWC matter is not mediated in a series, and
 * a desk that could schedule a second one has started doing exactly that.
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
            'Agreement retrieved'
        );
    }

    /**
     * Records the session, or corrects the one already recorded.
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
            'agreement' => ['nullable', 'string'],
            'survivor_acknowledged' => ['boolean'],
            'respondent_acknowledged' => ['boolean'],
        ], [
            'session_date.before_or_equal' => 'A session cannot be recorded for a future date.',
            'discussion.required' => 'Write what was discussed at the session.',
        ]);

        $agreement = Agreement::updateOrCreate(
            ['vawc_case_id' => $case->id],
            $validated + ['recorded_by' => auth()->id()]
        );

        return $this->success(
            $agreement->fresh()->load('recorder:id,name'),
            $agreement->wasRecentlyCreated
                ? 'Session and agreement recorded.'
                : 'The session record was updated.'
        );
    }
}
