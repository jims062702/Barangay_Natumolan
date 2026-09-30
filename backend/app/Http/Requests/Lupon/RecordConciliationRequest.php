<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The Pangkat ng Tagapagkasundo is a panel of exactly three Lupon
 * members (Local Government Code sec. 404) — chosen by the parties
 * from the Lupon list, or drawn by lot if they cannot agree. Not
 * "at least three": a panel of four has no basis in the law.
 */
class RecordConciliationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'conciliation_date' => 'required|date|before_or_equal:' . ManilaTime::now(),
            'pangkat_members' => 'required|array|size:3',
            'pangkat_members.*' => 'required|string|max:150',
            /* No Arbitration: this Lupon mediates and conciliates. A matter it
   cannot settle is dismissed, not arbitrated here. */
            'outcome' => 'required|in:Settlement,Dismissed',
            /*
             * A CLOSED CASE HAS TO SAY WHY IT CLOSED.
             *
             * This was nullable, so a case could be dismissed — the heaviest
             * entry the Lupon makes — with nothing beside it. A year later
             * the register read "Dismissed" and nobody in the office could
             * say what had happened, least of all to the complainant asking.
             */
            'proceedings_notes' => 'required_if:outcome,Dismissed|nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'pangkat_members.size' => 'The Pangkat is composed of exactly three Lupon members.',
            'conciliation_date.before_or_equal' => 'A conciliation cannot be recorded before it has taken place.',
            'proceedings_notes.required_if' => 'Say why the case is being dismissed — it is what the register will show.',
        ];
    }
}
