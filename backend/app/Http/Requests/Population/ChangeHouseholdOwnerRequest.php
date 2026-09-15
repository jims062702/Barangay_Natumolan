<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;

class ChangeHouseholdOwnerRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'household_head_id' => 'nullable|exists:residents,id',
            'reason' => 'nullable|string|max:60',
            'note' => 'nullable|string|max:255',
            'changed_on' => 'nullable|date|before_or_equal:today',
        ];
    }
}
