<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\Hearing;
use App\Services\Lupon\HearingCalendar;
use App\Services\Lupon\HearingDesk;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * The weeks of hearings, and the sitting that ends a case.
 *
 * The path a case walks here is fixed, so the office should not have to
 * arrange it a week at a time:
 *
 *   1. filed, and the filing fee receipt seen by the Lupon — which books
 *      THREE TUESDAYS with the Punong Barangay in the same press
 *   2. the Barangay Secretary prints the summons, and that is when the
 *      parties are told (see HearingController::printSummons)
 *   3. if nothing is agreed, THREE THURSDAYS with the Lupon — conciliation
 *   4. if still nothing, the Lupon may certify the case to file action
 *
 * Issuing the summons was once a press HERE that did steps 1 and 2 at once.
 * It is gone: the two happen in two offices at two different moments, and
 * one button doing both meant neither office could tell what the other had
 * done.
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
        /* The desk that keeps the record of THIS kind of sitting — the
           Secretary for a Tuesday, the Lupon for a Thursday, neither for
           the Punong Barangay, who presides rather than records. */
        $desk = HearingDesk::forType((string) $hearing->hearing_type);

        if (! HearingDesk::may(auth()->user(), $desk)) {
            return $this->error(HearingDesk::refusal($desk), 403);
        }

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
            /* Why it closed, in the words written at the table. */
            'closure_reason' => 'Settled at the sitting: ' . $validated['proceedings_notes'],
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

    /*
     * There is no toConciliation() any more.
     *
     * It was a button that ended the Punong Barangay's mediation early and
     * booked the Lupon's three Thursdays. The barangay gives the parties
     * three Tuesdays and they are entitled to all three: a case leaves the
     * Punong Barangay when the third is spent without agreement, and
     * HearingSession moves it there on its own. The Lupon then prints its
     * own summons, and THAT books the Thursdays — the same rule as the
     * first stage, so neither set of sittings exists before the paper that
     * calls the parties to them.
     */

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
