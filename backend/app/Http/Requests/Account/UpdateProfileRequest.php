<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'string|max:255',
            'email' => 'email|unique:users,email,' . $this->user()->id,
            'password' => 'nullable|min:8|confirmed',
        ];
    }
}
