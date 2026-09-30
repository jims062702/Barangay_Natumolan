<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Services\Lupon\HearingCalendar;
use App\Support\ChangeLog;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * The two ends a case can reach away from the table.
 *
 *   Withdrawn   the complainant took the complaint back. The Lupon has
 *               nothing further to work, so the sittings still on the
 *               calendar are stood down.
 *   CFA         the Lupon certified the case to file action: the parties
 *               could not settle, and the complainant may take it to court.
 *
 * Both are recorded with the words that go with them — why it was taken
 * back, or what the certification rests on — because "Withdrawn" with no
 * reason is a case nobody can explain a year later.
 */
class ClosureController extends BaseController
{
    /** The complainant takes the complaint back. */
    public function withdraw(Request $request, CaseFile $case, HearingCalendar $calendar)
    {
        /*
         * The Punong Barangay presides; they do not keep the record. Closing
         * a case is the heaviest entry in the room, and it belongs to the
         * desk that will have to explain it — the Secretary, or the Lupon.
         */
        if (auth()->user()?->role === 'Punong Barangay') {
            return $this->error(
                'Withdrawing a complaint is recorded by the Barangay Secretary or the Lupon, '
                    . 'at the desk where the complainant says so.',
                403
            );
        }

        if ($refusal = $this->refuseIfClosed($case)) {
            return $refusal;
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ], ['reason.required' => 'Say why the complaint is being withdrawn.']);

        $today = ManilaTime::today();

        $stood = $calendar->standDown($case, 'Stood down: the complaint was withdrawn on ' . $today . '.');

        $case->update([
            'current_stage' => 'Withdrawn',
            'date_resolved' => $today,
            'closure_reason' => $validated['reason'],
        ]);

        ChangeLog::bump('lupon_cases');

        return $this->success(
            $case->fresh()->load('hearings'),
            'The complaint was withdrawn and the case is closed.'
                . ($stood > 0 ? " {$stood} sitting(s) were stood down." : '')
        );
    }

    /**
     * Certified to file action: the Lupon could not settle it, so the
     * complainant may take it to court.
     *
     * NOT BEFORE A LUPON SITTING HAS BEEN HELD AND FAILED. The certificate
     * says the barangay's process was exhausted, and a court that receives
     * one issued before the Lupon ever sat can send the case straight back —
     * the complainant then loses months and starts again. So the button
     * waits for the first Thursday to be held without agreement; from that
     * sitting on, the complainant may ask for it whenever they choose, and
     * the Lupon issues it.
     */
    public function certifyToFileAction(Request $request, CaseFile $case, HearingCalendar $calendar)
    {
        if ($refusal = $this->refuseIfClosed($case)) {
            return $refusal;
        }

        if (! $case->conciliationWasTried()) {
            return $this->error(
                'A case is certified to file action once a sitting before the Lupon has been held '
                    . 'without agreement. This one has not reached that point yet.',
                422
            );
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ], ['reason.required' => 'Say what the certification rests on — the sittings held, and what came of them.']);

        $today = ManilaTime::today();

        $stood = $calendar->standDown($case, 'Stood down: the case was certified to file action on ' . $today . '.');

        $case->update([
            'current_stage' => 'CFA',
            'date_resolved' => $today,
            'closure_reason' => $validated['reason'],
        ]);

        ChangeLog::bump('lupon_cases');

        return $this->success(
            $case->fresh()->load('hearings'),
            'Certified to file action. The complainant may take the case to court.'
                . ($stood > 0 ? " {$stood} sitting(s) were stood down." : '')
        );
    }

    private function refuseIfClosed(CaseFile $case)
    {
        return $case->isClosed()
            ? $this->error('This case is already closed as ' . strtolower($case->current_stage) . '.', 422)
            : null;
    }
}
