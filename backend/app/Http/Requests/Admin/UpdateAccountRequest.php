<?php

namespace App\Http\Requests\Admin;

use App\Models\Account\User;
use App\Rules\OfficePassword;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAccountRequest extends FormRequest
{
    public function rules(): array
    {
        $user = $this->route('user');

        /*
         * The office rule when the account being saved is an office's — the
         * role it is BECOMING, if this request changes it, since that is the
         * account that will exist afterwards. A resident's portal account
         * keeps the plain rule: it never signs in offline.
         */
        $becomesOffice = ($this->input('role', $user->role)) !== 'Resident';

        return [
            'name' => 'string|max:255',
            'email' => 'email|unique:users,email,' . $user->id,
            'password' => $becomesOffice
                ? ['nullable', OfficePassword::rule()]
                : 'nullable|min:8',
            // Resident is allowed here (an existing portal account can be
            // corrected) but never when creating — those are made by the BPO.
            'role' => 'in:' . implode(',', [...User::ROLES, 'Resident']),
            'office' => 'in:' . implode(',', [...User::OFFICES, 'Resident']),
            'is_active' => 'boolean',
        ];
    }
}
