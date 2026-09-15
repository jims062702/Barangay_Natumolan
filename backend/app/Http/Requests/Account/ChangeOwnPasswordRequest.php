<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class ChangeOwnPasswordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'current_password' => 'required|string',
            'code' => 'required|string|size:6',
            'new_password' => 'required|string|min:8|confirmed',
        ];
    }
}
