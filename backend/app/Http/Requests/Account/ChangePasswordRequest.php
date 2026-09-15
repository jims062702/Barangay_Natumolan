<?php

namespace App\Http\Requests\Account;

use App\Rules\OfficePassword;
use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    public function rules(): array
    {
        /* An office account can be signed into with no line, so it is held to
           the stronger rule; a resident's is not — see OfficePassword. */
        $isOffice = $this->user()?->role !== 'Resident';

        return [
            'current_password' => 'required',
            'new_password' => $isOffice
                ? ['required', 'confirmed', OfficePassword::rule()]
                : 'required|min:8|confirmed',
        ];
    }
}
