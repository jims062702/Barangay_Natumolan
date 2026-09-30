<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\Followup;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFollowupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'followup_date' => ['required', 'date', 'before_or_equal:' . ManilaTime::today()],
            'conducted_by' => ['required', 'string', 'max:150'],
            'followup_type' => ['required', Rule::in(Followup::METHODS)],
            'safety_status' => ['required', Rule::in(Followup::SAFETY_STATUSES)],
            'protection_order_status' => ['required', Rule::in(Followup::PROTECTION_ORDER_STATUSES)],
            'services_received' => ['nullable', 'string', 'max:5000'],
            'new_incident' => ['required', 'boolean'],
            'additional_needs' => ['nullable', 'string', 'max:5000'],
            'next_action' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'next_followup_date' => ['nullable', 'date', 'after_or_equal:followup_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'followup_date.before_or_equal' => 'A follow-up cannot be recorded for a future date.',
            'conducted_by.required' => 'Say who conducted the follow-up.',
            'new_incident.required' => 'Say whether a new incident was reported.',
            'next_followup_date.after_or_equal' => 'The next follow-up cannot be before this one.',
        ];
    }
}
