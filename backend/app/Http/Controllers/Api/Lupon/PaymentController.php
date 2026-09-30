<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Payment;
use App\Services\Lupon\FilingFeeDeadlines;
use App\Services\Lupon\HearingCalendar;
use App\Support\ChangeLog;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * Whether a case's filing fee has been paid — confirmed by the Lupon.
 *
 * NO MONEY, AT ANY DESK. The complainant pays where the barangay takes
 * payments and comes back with the official receipt; the Lupon staff LOOK at
 * it and press Paid. Nobody at the Lupon or the Clerk's counter handles the
 * fee, and this records no amount and no receipt — only that the receipt
 * was seen, by whom and when, because the summons waits on it.
 *
 * It used to go through the Clerk: the Lupon sent the fee to the counter and
 * waited for the Clerk to mark it. That was a second office handling a
 * payment it never saw, and a case standing still until somebody at another
 * screen got to it.
 */
class PaymentController extends BaseController
{
    /**
     * The receipt was shown: the case's filing fee is paid, and the case is
     * FORWARDED to the Barangay Secretary.
     *
     * It books nothing. Confirming the fee used to put three Tuesdays on the
     * calendar there and then, which meant the Secretary was never handed
     * anything — they opened a calendar that had filled itself and had no
     * way to tell a case that had reached them from one that had not. Now
     * the case stands in their "For summons" list until they print, and the
     * printing is what books the Tuesdays.
     */
    public function paid(CaseFile $case)
    {
        /* Its three days may have ended a moment ago: settle that first. */
        FilingFeeDeadlines::closeOverdue();
        $case->refresh();

        if ($case->current_stage === CaseFile::CLOSED_UNPAID) {
            return $this->error('The ' . FilingFeeDeadlines::DAYS . ' days to pay the filing fee ended on '
                . FilingFeeDeadlines::dueWords($case->payment_due_at) . ', so the case was closed unpaid. '
                . 'The complainant may file the complaint again.', 422);
        }

        if ($case->isClosed()) {
            return $this->error('This case is closed; its filing fee can no longer be changed.', 422);
        }

        $already = $case->payments()
            ->where('kind', Payment::KIND_FILING)
            ->where('status', 'Paid')
            ->first();

        /* Pressed twice: the first is the record, the second changes nothing. */
        if ($already) {
            return $this->success($already->load('paidBy:id,name'), 'The filing fee is already marked paid.');
        }

        $now = ManilaTime::now();

        $payment = $case->payments()->create([
            'kind' => Payment::KIND_FILING,
            'status' => 'Paid',
            'requested_by' => auth()->id(),
            'requested_at' => $now,
            'paid_by' => auth()->id(),
            'paid_at' => $now,
            'notes' => 'Official receipt seen by the Lupon.',
        ]);

        /* The fee's state first; the stage moves as it always has. */
        $case->update(['payment_status' => FilingFeeDeadlines::PAID]);
        FilingFeeDeadlines::record($case, 'fee_paid', 'Official receipt seen by the Lupon.');

        if ($case->current_stage === 'Filed') {
            $case->update(['current_stage' => 'For Summons']);
        }

        ChangeLog::bump('lupon_cases');

        return $this->success(
            [
                'payment' => $payment->load('paidBy:id,name'),
                'case' => $case->fresh()->load('hearings'),
            ],
            'Filing fee marked paid. The case has gone to the Barangay Secretary, '
                . 'who prints the summons — and that printing books the three Tuesdays '
                . 'with the Punong Barangay.'
        );
    }

    /**
     * A mis-click, put right.
     *
     * Only before the summons: once the summons has gone out on the strength
     * of the fee, taking the fee back would leave a case moving on a payment
     * the record says never happened. Kept as Cancelled rather than deleted,
     * so who pressed Paid, and who took it back, stays on the record.
     */
    public function undo(CaseFile $case, HearingCalendar $calendar)
    {
        if ($case->hearings()->where('summons_issued', true)->exists()) {
            return $this->error('The summons has already been printed on this fee, so it can no longer be undone.', 422);
        }

        $paid = $case->payments()
            ->where('kind', Payment::KIND_FILING)
            ->where('status', 'Paid')
            ->get();

        if ($paid->isEmpty()) {
            return $this->error('The filing fee is not marked paid.', 422);
        }

        $paid->each->update([
            'status' => 'Cancelled',
            'notes' => 'Paid was undone by ' . (auth()->user()?->name ?? 'the Lupon') . ' on '
                . Carbon::now(ManilaTime::ZONE)->format('M j, Y g:i A') . '.',
        ]);

        /* Unpaid again, on the same three days: a deadline already past
           closes the case at the next sweep, as the rule says. */
        $case->update(['payment_status' => FilingFeeDeadlines::UNPAID]);
        FilingFeeDeadlines::record($case, 'fee_undone', 'Paid was undone.');

        /*
         * Nothing is normally booked at this point — the fee forwards the
         * case, the summons books the sittings — but a case carried over
         * from the old order may still hold Tuesdays that went on the
         * calendar with the receipt, and a sitting nobody will hold must not
         * stand on it.
         */
        $stood = $calendar->standDown($case, 'Stood down: the filing fee was put back to unpaid.');

        if (
            in_array($case->current_stage, ['For Summons', 'Mediation'], true)
            && ! $case->hearings()->where('status', 'Completed')->exists()
        ) {
            $case->update(['current_stage' => 'Filed']);
        }

        ChangeLog::bump('lupon_cases');

        return $this->success(null, 'Put back to unpaid.'
            . ($stood > 0 ? " {$stood} sitting(s) were stood down." : '')
            . ' The calendar waits until the receipt is seen.');
    }
}
