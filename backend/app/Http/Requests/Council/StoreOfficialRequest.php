<?php

namespace App\Http\Requests\Council;

use Illuminate\Foundation\Http\FormRequest;

class StoreOfficialRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'group' => 'required|in:Barangay,SK',
            'position' => 'required|string|max:150',
            /* What they are responsible for, as the clearance sidebar prints it. */
            'committees' => 'nullable|string|max:300',
            'name' => 'required|string|max:150',
            'term' => 'nullable|string|max:60',
            'photo' => 'nullable|image|max:5120',
        ];
    }
}
