<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

class RecordMediationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // Datetime: a proceeding happens at an hour, and it is recorded
            // after it took place, never ahead of it.
            'mediation_date' => 'required|date|before_or_equal:' . ManilaTime::now(),
            'attendance' => 'required|in:Both Present,Complainant Only,Respondent Only,Neither',
            'outcome' => 'required|in:Settlement Reached,No Settlement,Rescheduled',
            'proceedings_notes' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'mediation_date.before_or_equal' => 'A mediation cannot be recorded before it has taken place.',
        ];
    }
}
