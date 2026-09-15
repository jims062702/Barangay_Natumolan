<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;

class VerifyEventRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'verification_status' => 'required|in:Verified,Rejected',
            'verification_notes' => 'nullable|string',
        ];
    }
}
