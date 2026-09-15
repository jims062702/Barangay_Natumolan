<?php

namespace App\Http\Requests\Admin;

use App\Models\Account\User;
use App\Support\OfficePassword;
use Illuminate\Foundation\Http\FormRequest;

class StoreStaffAccountRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            /* Office accounts only are made here, and an office account can
               be signed into with no line — see OfficePassword. */
            'password' => ['required', OfficePassword::rule()],
            'role' => 'required|in:' . implode(',', User::ROLES),
            'office' => 'required|in:' . implode(',', User::OFFICES),
        ];
    }
}
