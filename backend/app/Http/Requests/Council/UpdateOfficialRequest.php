<?php

namespace App\Http\Requests\Council;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOfficialRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'group' => 'in:Barangay,SK',
            'position' => 'string|max:150',
            'name' => 'string|max:150',
            'term' => 'nullable|string|max:60',
            'photo' => 'nullable|image|max:5120',
        ];
    }
}
