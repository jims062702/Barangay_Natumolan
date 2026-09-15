<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/** An email and a password: signing in, or asking for the activation code again. */
class CredentialsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'email' => 'required|email',
            'password' => 'required',
        ];
    }
}
