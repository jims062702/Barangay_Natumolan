<?php

namespace App\Services\Vawc;

use App\Models\Vawc\CaseFile;
use App\Models\Vawc\ProtectionOrder;
use App\Support\ManilaTime;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * One set of rules for a Barangay Protection Order, wherever it is written.
 *
 * The intake form can record one ("Immediate protection needed? Yes"), and
 * so can the case's "Apply for BPO". Both go through here, so an order is
 * never valid on one screen and refused on the other.
 *
 * What each status asks for:
 *
 *   Not Yet Applied, Application Prepared   no dates yet
 *   Applied                                 the date it was applied for
 *   Issued                                  the date, and who issued it — the
 *                                           Punong Barangay, or an available
 *                                           Kagawad — and by name
 *   Not Issued, Referred for TPO/PPO        nothing more; the notes say why
 *
 * The last day in effect is never typed: it is fifteen days counted from the
 * day of issuance (ProtectionOrder::lastDayFor).
 */
final class ProtectionOrderForm
{
    /** The statuses of an application the desk is still working on. */
    public const OPEN_STATUSES = ['Not Yet Applied', 'Application Prepared', 'Applied'];

    /** @param string $prefix "protection_order." when nested in the intake form */
    public static function rules(string $prefix = ''): array
    {
        $today = ManilaTime::today();

        return [
            $prefix . 'status' => ['required', Rule::in(ProtectionOrder::STATUSES)],
            $prefix . 'applied_on' => [
                'nullable', 'date', 'before_or_equal:' . $today, 'required_if:' . $prefix . 'status,Applied',
            ],
            $prefix . 'issued_on' => [
                'nullable', 'date', 'before_or_equal:' . $today, 'required_if:' . $prefix . 'status,Issued',
            ],
            $prefix . 'issued_by' => [
                'nullable', Rule::in(ProtectionOrder::ISSUERS), 'required_if:' . $prefix . 'status,Issued',
            ],
            $prefix . 'issued_by_name' => [
                'nullable', 'string', 'max:150', 'required_if:' . $prefix . 'status,Issued',
            ],
            $prefix . 'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public static function messages(string $prefix = ''): array
    {
        return [
            $prefix . 'applied_on.required_if' => 'Enter the date the BPO was applied for.',
            $prefix . 'applied_on.before_or_equal' => 'A BPO cannot be applied for on a future date.',
            $prefix . 'issued_on.required_if' => 'Enter the date the BPO was issued.',
            $prefix . 'issued_on.before_or_equal' => 'A BPO cannot be issued on a future date.',
            $prefix . 'issued_by.required_if' => 'Say who issued the BPO: the Punong Barangay or a Barangay Kagawad.',
            $prefix . 'issued_by_name.required_if' => 'Enter the name of the official who issued the BPO.',
        ];
    }

    /** Checks that need two answers at once: an order is issued on or after it is applied for. */
    public static function checkDates(Validator $validator, array $data, string $prefix = ''): void
    {
        $applied = $data['applied_on'] ?? null;
        $issued = $data['issued_on'] ?? null;

        if (($data['status'] ?? null) === 'Issued' && $applied && $issued && $issued < $applied) {
            $validator->errors()->add($prefix . 'issued_on', 'A BPO cannot be issued before it was applied for.');
        }
    }

    /**
     * The columns to store, with every answer that does not belong to the
     * chosen status taken off — an order moved back from Issued must not keep
     * an issuing official, and a "fifteen days" that no longer applies.
     */
    public static function attributes(array $data): array
    {
        $status = $data['status'];
        $issued = $status === 'Issued';

        $appliedOn = in_array($status, ['Not Yet Applied', 'Application Prepared'], true)
            ? null
            : ($data['applied_on'] ?? null);

        /* Issued the day it was applied for, when nobody wrote a separate
           date — the law expects a BPO the same day the application is made. */
        if ($issued && ! $appliedOn) {
            $appliedOn = $data['issued_on'];
        }

        return [
            'status' => $status,
            'applied_on' => $appliedOn,
            'issued_on' => $issued ? $data['issued_on'] : null,
            'expires_on' => $issued ? ProtectionOrder::lastDayFor($data['issued_on']) : null,
            'issued_by' => $issued ? $data['issued_by'] : null,
            'issued_by_name' => $issued ? trim($data['issued_by_name']) : null,
            'notes' => isset($data['notes']) && trim($data['notes']) !== '' ? trim($data['notes']) : null,
        ];
    }

    /**
     * Why a NEW order cannot be started on this case right now, if it cannot.
     *
     * One application at a time: a second "Applied" beside the first is the
     * same application written twice. And an order still in effect is
     * renewed, not applied for again, so the history reads as one chain.
     */
    public static function refusalToStart(CaseFile $case, ?int $renewalOfId): ?string
    {
        if ($case->status !== 'Active') {
            return 'This case is closed. Reopen it before recording a protection order.';
        }

        if (! $case->respondent_id) {
            return 'Name the respondent before recording a protection order — a BPO is issued against a person.';
        }

        if ($case->protectionOrders()->whereIn('status', self::OPEN_STATUSES)->exists()) {
            return 'This case already has a BPO application in progress. Update that one instead of starting another.';
        }

        if ($renewalOfId) {
            $renewed = $case->protectionOrders()->whereKey($renewalOfId)->first();

            if (! $renewed || $renewed->status !== 'Issued') {
                return 'Only an issued BPO can be renewed.';
            }

            if (ProtectionOrder::where('renewal_of_id', $renewed->id)->exists()) {
                return 'That BPO has already been renewed. Renew the latest one.';
            }

            return null;
        }

        $inEffect = $case->protectionOrders()->where('status', 'Issued')->get()->first(fn ($o) => $o->in_effect);

        if ($inEffect) {
            return 'A BPO is in effect until ' . $inEffect->expires_on->format('F j, Y')
                . '. Renew it instead of applying for another.';
        }

        return null;
    }
}
