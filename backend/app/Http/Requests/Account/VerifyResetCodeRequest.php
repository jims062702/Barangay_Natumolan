<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class VerifyResetCodeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'email' => 'required|email|max:150',
            'code' => 'required|string|size:6',
        ];
    }
}
