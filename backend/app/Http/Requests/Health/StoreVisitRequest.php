<?php

namespace App\Http\Requests\Health;

use Illuminate\Foundation\Http\FormRequest;

class StoreVisitRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'patient_id' => 'required|exists:residents,id',
            'visit_date' => 'required|date',
            'visit_reason' => 'required|string',
            'temperature' => 'nullable|numeric',
            'blood_pressure' => 'nullable|string',
            'heart_rate' => 'nullable|integer',
            'symptoms' => 'nullable|string',
            'observations' => 'nullable|string',
            'consultation_notes' => 'nullable|string',
            'treatment_advice' => 'nullable|string',
            'followup_schedule' => 'nullable|date',
            'referral_recommended' => 'boolean',
            'referral_destination' => 'nullable|string',
        ];
    }
}
