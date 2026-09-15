<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\RecordHearingOutcomeRequest;
use App\Http\Requests\Lupon\RecordSummonsRequest;
use App\Http\Requests\Lupon\RescheduleHearingRequest;
use App\Http\Requests\Lupon\ScheduleHearingRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Services\Lupon\HearingNotice;
use Illuminate\Http\Request;

/**
 * Hearings: set on a case, and worked from the desk-wide calendar —
 * summons and proof of service, attendance and outcome, and resetting a date.
 */
class HearingController extends BaseController
{
    /** 3.4 — the hearing calendar across the whole docket. */
    public function index(Request $request)
    {
        $query = Hearing::with(array_merge(CaseFile::WITH_PARTIES, ['recorder:id,name']));

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('hearing_type')) {
            $query->where('hearing_type', $request->hearing_type);
        }

        /*
         * Buckets are whole DAYS, not the current instant. Comparing against
         * now() moved a 9am hearing into "past" by 9:01, so the day's own
         * hearings vanished from the desk while they were still being held.
         */
        if ($request->filled('when')) {
            match ($request->when) {
                'today' => $query->whereDate('scheduled_at', today())->orderBy('scheduled_at'),
                'upcoming' => $query->whereDate('scheduled_at', '>', today())->orderBy('scheduled_at'),
                'past' => $query->whereDate('scheduled_at', '<', today())->orderByDesc('scheduled_at'),
                default => $query->orderByDesc('scheduled_at'),
            };
        } else {
            $query->orderByDesc('scheduled_at');
        }

        // Hearings set but with no summons served yet — the service backlog.
        if ($request->boolean('unserved')) {
            $query->where('status', 'Scheduled')->whereNull('summons_served_date');
        }

        return $this->success($query->paginate(20), 'Hearings retrieved');
    }

    public function store(ScheduleHearingRequest $request, CaseFile $case, HearingNotice $notice)
    {
        $validated = $request->validated();

        $hearing = $case->hearings()->create($validated + ['recorded_by' => auth()->id()]);

        if ($case->current_stage === 'Filed' && $validated['hearing_type'] === 'Mediation') {
            $case->update(['current_stage' => 'Mediation']);
        }

        $notice->toParties(
            $case,
            'KP Hearing Scheduled — ' . $case->case_number,
            sprintf('A %s hearing is scheduled on %s at the Barangay Hall. Attendance is required.',
                strtolower($validated['hearing_type']),
                date('F j, Y g:i A', strtotime($validated['scheduled_at'])))
        );

        return $this->success($hearing, 'Hearing scheduled', 201);
    }

    /** 3.4 — record attendance and the outcome straight from the calendar. */
    public function update(RecordHearingOutcomeRequest $request, Hearing $hearing)
    {
        $validated = $request->validated();

        $hearing->update($validated + ['recorded_by' => auth()->id()]);
        $hearing->load(CaseFile::WITH_PARTIES);

        return $this->success($hearing, 'Hearing outcome recorded');
    }

    public function recordOutcome(Request $request, CaseFile $case, Hearing $hearing)
    {
        if ($hearing->lupon_case_id !== $case->id) {
            return $this->notFound('Hearing does not belong to this case');
        }

        /* Validated after the check above, so a hearing from another case is
           reported as that rather than as a form error. */
        $validated = $request->validate(RecordHearingOutcomeRequest::RULES);

        $hearing->update($validated);

        return $this->success($hearing, 'Hearing outcome recorded');
    }

    /**
     * 3.4 — summons and proof of service. `summons_served_date` is the
     * proof-of-service record required before a party can be defaulted.
     */
    public function recordSummons(RecordSummonsRequest $request, Hearing $hearing)
    {
        $validated = $request->validated();

        if (!empty($validated['summons_served_date']) && !$validated['summons_issued']) {
            return $this->error('A summons cannot be served before it is issued.', 422);
        }

        $hearing->update($validated);
        $hearing->load(CaseFile::WITH_PARTIES);

        return $this->success($hearing, 'Summons record updated');
    }

    /**
     * 3.4 — resetting a hearing keeps the original in the record (marked
     * Rescheduled) and opens a fresh one, so the trail shows both dates.
     */
    public function reschedule(RescheduleHearingRequest $request, Hearing $hearing, HearingNotice $notice)
    {
        $validated = $request->validated();

        if (in_array($hearing->status, ['Completed', 'Cancelled'], true)) {
            return $this->error('A ' . strtolower($hearing->status) . ' hearing cannot be rescheduled.', 422);
        }

        $hearing->update([
            'status' => 'Rescheduled',
            'outcome' => $validated['reason'] ?? 'Rescheduled',
            'recorded_by' => auth()->id(),
        ]);

        $case = $hearing->luponCase;

        $replacement = $case->hearings()->create([
            'hearing_type' => $hearing->hearing_type,
            'scheduled_at' => $validated['scheduled_at'],
            'status' => 'Scheduled',
            'summons_issued' => $hearing->summons_issued,
            'recorded_by' => auth()->id(),
        ]);

        $notice->toParties(
            $case,
            'KP Hearing Reset — ' . $case->case_number,
            sprintf('Your %s hearing has been moved to %s at the Barangay Hall. Attendance is required.',
                strtolower($hearing->hearing_type),
                date('F j, Y g:i A', strtotime($validated['scheduled_at'])))
        );

        $replacement->load(CaseFile::WITH_PARTIES);

        return $this->success($replacement, 'Hearing rescheduled — parties notified', 201);
    }
}
