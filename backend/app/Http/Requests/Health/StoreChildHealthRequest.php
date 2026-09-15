<?php

namespace App\Http\Requests\Health;

use Illuminate\Foundation\Http\FormRequest;

class StoreChildHealthRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'child_id' => 'required|exists:residents,id',
            'birth_date' => 'required|date',
            'birth_weight' => 'nullable|numeric',
            'current_weight' => 'nullable|numeric',
            'current_height' => 'nullable|numeric',
            'nutritional_status' => 'nullable|string',
            'growth_monitoring_notes' => 'nullable|string',
            'vitamin_services_received' => 'boolean',
            'breastfeeding_status' => 'nullable|string',
            'feeding_counseling_notes' => 'nullable|string',
            'referral_needed' => 'boolean',
            'referral_destination' => 'nullable|string',
        ];
    }
}
