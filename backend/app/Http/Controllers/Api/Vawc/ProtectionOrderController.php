<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\ProtectionOrder;
use App\Services\Vawc\ProtectionOrderForm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Barangay Protection Orders on a case: applying, issuing, renewing.
 *
 * NOTHING HERE WAITS ON A DIALOGUE. A case may come straight to a BPO, and
 * whether the parties ever sat down together is not asked: RA 9262 §33 bars
 * the barangay from pressing a victim-survivor to settle, or to give up any
 * relief she asks for, before she is protected.
 */
class ProtectionOrderController extends BaseController
{
    /** A new application — or, with renewal_of_id, the renewal of an issued order. */
    public function store(Request $request, CaseFile $case)
    {
        $renewalOf = $request->integer('renewal_of_id') ?: null;

        if ($refusal = ProtectionOrderForm::refusalToStart($case, $renewalOf)) {
            return $this->error($refusal, 422);
        }

        $validated = $this->validated($request, $renewalOf ? $case->protectionOrders()->find($renewalOf) : null);

        $order = $case->protectionOrders()->create(ProtectionOrderForm::attributes($validated) + [
            'renewal_of_id' => $renewalOf,
            'recorded_by' => auth()->id(),
        ]);

        AccessLog::record($case->id, $renewalOf ? 'bpo_renewed' : 'bpo_recorded', 'BPO: ' . $order->status);

        return $this->success($order->fresh(), $this->message($order, $renewalOf !== null), 201);
    }

    /** Moves an order along — Applied to Issued — or corrects it. */
    public function update(Request $request, CaseFile $case, ProtectionOrder $order)
    {
        if ($order->vawc_case_id !== $case->id) {
            return $this->notFound('That protection order does not belong to this case');
        }

        $validated = $this->validated($request, $order->renews);

        $order->update(ProtectionOrderForm::attributes($validated));

        AccessLog::record($case->id, 'bpo_updated', 'BPO: ' . $order->status);

        return $this->success($order->fresh(), $this->message($order, false));
    }

    private function validated(Request $request, ?ProtectionOrder $renewed): array
    {
        $validator = Validator::make(
            $request->all(),
            ProtectionOrderForm::rules(),
            ProtectionOrderForm::messages()
        );

        $validator->after(function ($validator) use ($request, $renewed) {
            ProtectionOrderForm::checkDates($validator, $request->all());

            /* A renewal starts after the order it renews was issued. */
            $issued = $request->input('issued_on');

            if ($renewed?->issued_on && $issued && $issued <= $renewed->issued_on->toDateString()) {
                $validator->errors()->add(
                    'issued_on',
                    'A renewal is issued after the BPO it renews (issued ' . $renewed->issued_on->format('F j, Y') . ').'
                );
            }
        });

        return $validator->validate();
    }

    private function message(ProtectionOrder $order, bool $renewal): string
    {
        if ($order->status === 'Issued') {
            return ($renewal ? 'BPO renewed' : 'BPO recorded as issued')
                . ' — in effect until ' . $order->expires_on->format('F j, Y') . '.';
        }

        return 'Protection order recorded: ' . $order->status . '.';
    }
}
