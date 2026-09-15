<?php

namespace App\Http\Requests\Health;

use Illuminate\Foundation\Http\FormRequest;

class StoreMaternalHealthRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'mother_id' => 'required|exists:residents,id',
            'pregnancy_registration_date' => 'required|date',
            'expected_delivery_date' => 'nullable|date|after:pregnancy_registration_date',
            'actual_delivery_date' => 'nullable|date',
            'prenatal_visits_count' => 'integer|min:0',
            'risk_indicators' => 'nullable|string',
            'post_natal_followup_required' => 'boolean',
            'family_planning_method' => 'nullable|string',
            'family_planning_counseling_notes' => 'nullable|string',
            'maternal_immunization_received' => 'boolean',
            'referral_to_hospital' => 'boolean',
            'referral_reason' => 'nullable|string',
            'status' => 'in:Active,Delivered,Closed',
        ];
    }
}
