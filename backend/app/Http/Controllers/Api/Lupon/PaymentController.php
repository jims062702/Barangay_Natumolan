<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;
use App\Support\ChangeLog;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Payment;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * Whether a case's filing fee has been settled.
 *
 * NOT A COLLECTIONS DESK. This system handles no money: the barangay takes
 * the fee at the counter and keeps its own book of it. What is recorded here
 * is a single fact the Lupon needs and cannot get any other way — has this
 * complainant paid? — because the summons is blocked until they have.
 *
 * So there are no amounts, no receipts and no totals. The Clerk marks it Paid
 * or back to Unpaid, and the Lupon sees it.
 */
class PaymentController extends BaseController
{
    /** What the Clerk still has to confirm, and what has been settled. */
    public function index(Request $request)
    {
        $payments = Payment::with([
                'luponCase:id,case_number,case_title,complainant_id,complainant_name',
                'luponCase.complainant:id,first_name,middle_name,last_name,suffix',
                'requestedBy:id,name',
                'paidBy:id,name',
            ])
            ->when(
                $request->input('status', 'Requested') !== 'all',
                fn ($query) => $query->where('status', $request->input('status', 'Requested'))
            )
            /* Unsettled first: it is the only row anybody has to act on. */
            ->orderByRaw("FIELD(status, 'Requested', 'Paid', 'Cancelled')")
            ->orderBy('requested_at')
            ->paginate(25);

        return $this->success([
            'payments' => $payments,
            'outstanding' => Payment::outstanding()->count(),
            'settled' => Payment::where('status', 'Paid')->count(),
        ], 'Lupon filing fees retrieved');
    }

    /**
     * The Lupon tells the Clerk this case owes its filing fee.
     *
     * One live request per case. Two clicks would put the same complainant on
     * the Clerk's list twice; the standing one is handed back instead, so the
     * second click is a no-op rather than an error somebody has to read.
     */
    public function store(Request $request, CaseFile $case)
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $standing = $case->payments()
            ->where('kind', Payment::KIND_FILING)
            ->whereIn('status', ['Requested', 'Paid'])
            ->first();

        if ($standing) {
            return $this->success(
                $standing->load('requestedBy:id,name', 'paidBy:id,name'),
                $standing->status === 'Paid'
                    ? 'The filing fee for this case is already marked paid.'
                    : 'The filing fee is already on the Clerk\'s list.'
            );
        }

        $payment = $case->payments()->create([
            'kind' => Payment::KIND_FILING,
            'status' => 'Requested',
            'requested_by' => auth()->id(),
            'requested_at' => ManilaTime::now(),
            'notes' => $validated['notes'] ?? null,
        ]);

        /*
         * And the other direction: tell the COUNTER somebody is coming.
         *
         * Same gap, mirrored. The Clerk's list is on a dashboard card they
         * may not be looking at, and a complainant who walks up to a counter
         * that does not know they are expected gets sent away to wait.
         */
        /* The case's readiness changed, so every docket watching cases
           reloads — the payment row is not itself a topic anybody waits on. */
        ChangeLog::bump('lupon_cases');

        Notification::notifyFrontDesk(
            'lupon_fee_requested',
            'Filing fee to collect — ' . $case->case_number,
            'The Lupon has sent a complainant to pay the filing fee on this case. '
                . 'Mark it paid once they have.',
            'lupon_case',
            $case->id
        );

        return $this->success(
            $payment->load('requestedBy:id,name'),
            'Sent to the Clerk. Nothing moves on this case until it is marked paid.'
        );
    }

    /**
     * The Clerk marks it Paid, or puts it back to Unpaid.
     *
     * REVERSIBLE, deliberately. Marking the wrong case paid is a mis-click,
     * and the previous version of this refused to undo it on the grounds that
     * a receipt had been written — but there is no receipt any more, only a
     * status somebody set by hand. A status set by hand has to be correctable
     * by hand, or the fix becomes a database edit.
     *
     * Who set it and when is kept either way, so the change is not silent.
     */
    public function mark(Request $request, Payment $payment)
    {
        $validated = $request->validate([
            'paid' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        if ($payment->status === 'Cancelled') {
            return $this->error('This request was withdrawn and cannot be settled.', 422);
        }

        $paid = $validated['paid'];

        $payment->update([
            'status' => $paid ? 'Paid' : 'Requested',
            'paid_by' => $paid ? auth()->id() : null,
            'paid_at' => $paid ? ManilaTime::now() : null,
            'notes' => $validated['notes'] ?? $payment->notes,
        ]);

        /*
         * TELL THE LUPON. This is the whole point of the two-office split.
         *
         * The Lupon asks the Clerk for the fee and then cannot issue the
         * summons until it is settled — but the settling happens at another
         * counter, on another screen. Without this the Lupon office learns
         * about it by reopening the case and looking, which means they learn
         * about it late, and the complainant waits for a summons that could
         * have gone out that morning.
         *
         * Sent both ways: putting it back to unpaid stops a case the Lupon
         * may already have started to move on.
         */
        $case = $payment->luponCase;

        ChangeLog::bump('lupon_cases');

        Notification::notifyLupon(
            $paid ? 'lupon_fee_paid' : 'lupon_fee_unpaid',
            $paid
                ? 'Filing fee paid — ' . ($case?->case_number ?? 'a case')
                : 'Filing fee put back to unpaid — ' . ($case?->case_number ?? 'a case'),
            $paid
                ? 'The Clerk has marked the filing fee settled. You can issue the summons.'
                : 'The Clerk has put this filing fee back to unpaid. The summons is blocked again.',
            'lupon_case',
            $case?->id
        );

        return $this->success(
            $payment->fresh()->load('luponCase:id,case_number', 'paidBy:id,name'),
            $paid
                ? 'Marked paid. The Lupon has been told and can proceed.'
                : 'Put back to unpaid. The Lupon has been told the summons is blocked again.'
        );
    }

    /**
     * The Lupon withdraws a request it should not have made.
     *
     * Cancelled rather than deleted: "asked for and withdrawn" is a thing the
     * counter may have already acted on, and a row that disappears cannot
     * explain why somebody was sent to pay and then turned away.
     */
    public function cancel(Payment $payment)
    {
        if ($payment->status === 'Paid') {
            return $this->error('This is already marked paid and cannot be withdrawn.', 422);
        }

        $payment->update(['status' => 'Cancelled']);

        ChangeLog::bump('lupon_cases');

        return $this->success($payment->fresh(), 'The request was withdrawn.');
    }
}
