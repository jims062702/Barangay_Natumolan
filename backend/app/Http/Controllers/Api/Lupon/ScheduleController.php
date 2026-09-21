<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Payment;
use App\Services\Lupon\HearingCalendar;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Summons, and the weeks of hearings that follow it.
 *
 * The path a case walks here is fixed, so the office should not have to
 * arrange it a week at a time:
 *
 *   1. filed, and the ₱20 filing fee paid at the Clerk's counter
 *   2. the Lupon issues the summons to the respondent
 *   3. THREE TUESDAYS with the Punong Barangay — mediation
 *   4. if nothing is agreed, THREE THURSDAYS with the Lupon — conciliation
 *   5. if still nothing, the complainant may take a Certificate to File
 *      Action, which costs ₱200 plus a ₱30 documentary stamp
 *
 * All three sittings of a stage are put on the calendar at once. A clerk who
 * must click "schedule the next hearing" after every session is a clerk who,
 * on a busy Tuesday, does not — and the case then sits with no date on it and
 * nothing on screen to say it is waiting.
 */
class ScheduleController extends BaseController
{
    public function __construct(private readonly HearingCalendar $calendar)
    {
    }

    /**
     * Issues the summons and books the Punong Barangay's three Tuesdays.
     *
     * BLOCKED ON THE FILING FEE. "Nothing is processed until it is paid" is
     * the barangay's rule, and the block belongs here rather than in the
     * screen: a rule enforced only in the form is a rule that lasts until
     * somebody opens a second window.
     */
    public function issueSummons(Request $request, CaseFile $case)
    {
        $paid = $case->payments()
            ->where('kind', Payment::KIND_FILING)
            ->where('status', 'Paid')
            ->exists();

        if (! $paid) {
            $asked = $case->payments()
                ->where('kind', Payment::KIND_FILING)
                ->where('status', 'Requested')
                ->exists();

            return $this->error(
                $asked
                    ? 'The ₱20 filing fee is with the Clerk but has not been paid yet. '
                        . 'The summons can be issued once the complainant has paid.'
                    : 'The ₱20 filing fee has not been paid. Send it to the Clerk for '
                        . 'collection first — nothing on the case moves until it is paid.',
                422
            );
        }

        $hearings = $this->calendar->schedule(
            $case,
            'Mediation',
            Carbon::now(ManilaTime::ZONE),
            summonsOnFirst: true
        );

        if ($case->current_stage === 'Filed') {
            $case->update(['current_stage' => 'Mediation']);
        }

        return $this->success([
            'case' => $case->fresh()->load('hearings'),
            'hearings' => $hearings,
        ], 'Summons issued. Three Tuesdays with the Punong Barangay are on the calendar.');
    }

    /**
     * The parties agreed at this sitting, so the case is over.
     *
     * The Punong Barangay settles at the table. This is the one action that
     * CLOSES a case: the sitting is written up, the case is marked settled,
     * and every sitting still on the calendar — the remaining Tuesdays, and
     * any Thursday already booked — is stood down. The Lupon has nothing
     * further to work.
     *
     * The minutes come with it rather than afterwards. An agreement recorded
     * with no account of how it was reached is the one a party later disputes.
     */
    public function settleAtHearing(Request $request, Hearing $hearing)
    {
        $validated = $request->validate([
            'proceedings_notes' => ['required', 'string'],
            'outcome' => ['nullable', 'string', 'max:255'],
            'complainant_present' => ['nullable', 'boolean'],
            'respondent_present' => ['nullable', 'boolean'],
        ], [
            'proceedings_notes.required' =>
                'Write the minutes of this sitting before closing the case.',
        ]);

        $case = $hearing->luponCase;

        if (! $case) {
            return $this->notFound('This hearing is not attached to a case.');
        }

        if ($case->current_stage === 'Settled') {
            return $this->error('This case is already settled.', 422);
        }

        $hearing->update([
            'status' => 'Completed',
            'proceedings_notes' => $validated['proceedings_notes'],
            'outcome' => $validated['outcome'] ?? 'Settlement Reached',
            'complainant_present' => $validated['complainant_present'] ?? $hearing->complainant_present,
            'respondent_present' => $validated['respondent_present'] ?? $hearing->respondent_present,
            'recorded_by' => auth()->id(),
        ]);

        $case->update([
            'current_stage' => 'Settled',
            'date_resolved' => ManilaTime::today(),
        ]);

        $standDown = $this->calendar->standDown(
            $case,
            'Stood down: the case settled on ' . ManilaTime::today() . '.'
        );

        return $this->success([
            'hearing' => $hearing->fresh(),
            'case' => $case->fresh()->load('hearings'),
            'stood_down' => $standDown,
        ], $standDown > 0
            ? "Case settled and closed. {$standDown} remaining sitting(s) were stood down."
            : 'Case settled and closed.');
    }

    /**
     * Mediation is over without an agreement, so the Lupon takes it up.
     *
     * Books the three Thursdays, and stands down any Tuesday still on the
     * calendar — a session nobody will attend, left showing as scheduled, is
     * how a docket comes to disagree with the hall.
     */
    public function toConciliation(Request $request, CaseFile $case)
    {
        if ($case->current_stage === 'Settled') {
            return $this->error('This case is already settled.', 422);
        }

        $this->calendar->standDown(
            $case,
            'Mediation closed without an agreement; the case went to the Lupon.',
            'Mediation'
        );

        $hearings = $this->calendar->schedule($case, 'Conciliation', Carbon::now(ManilaTime::ZONE));

        $case->update(['current_stage' => 'Conciliation']);

        return $this->success([
            'case' => $case->fresh()->load('hearings'),
            'hearings' => $hearings,
        ], 'Three Thursdays with the Lupon are on the calendar.');
    }

    /*
     * There is no requestCfa() any more.
     *
     * It put ₱200 and a ₱30 documentary stamp on the Clerk's counter and
     * stood the remaining sittings down, so a conciliation that failed could
     * be certified to court. This barangay no longer issues a Certificate to
     * File Action, and this system handles no money at all — both the
     * certificate and the fee schedule behind it are gone.
     *
     * A conciliation that reaches no agreement is recorded as Dismissed by
     * ProceedingController, which stands the calendar down the same way.
     */

}
