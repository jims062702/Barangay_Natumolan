<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;

class StoreHouseholdRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'household_number' => 'required|unique:households',
            'zone_purok' => 'required|string',
            'street_address' => 'required|string',
            'house_type' => 'nullable|string',
            'household_head_id' => 'nullable|exists:residents,id',
            'notes' => 'nullable|string',
        ];
    }
}
