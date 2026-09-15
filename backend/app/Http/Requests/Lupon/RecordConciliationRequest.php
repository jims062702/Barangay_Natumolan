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
            'outcome' => 'required|in:Settlement,Arbitration,Dismissed',
            'proceedings_notes' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'pangkat_members.size' => 'The Pangkat is composed of exactly three Lupon members.',
            'conciliation_date.before_or_equal' => 'A conciliation cannot be recorded before it has taken place.',
        ];
    }
}
