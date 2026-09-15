<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateHouseholdRequest extends FormRequest
{
    public function rules(): array
    {
        $household = $this->route('household');

        return [
            'household_number' => ['required', Rule::unique('households')->ignore($household->id)],
            'zone_purok' => 'required|string',
            'street_address' => 'required|string',
            'house_type' => 'nullable|string',
            'household_head_id' => 'nullable|exists:residents,id',
            'notes' => 'nullable|string',
        ];
    }
}
