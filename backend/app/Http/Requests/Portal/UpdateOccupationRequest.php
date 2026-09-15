<?php

namespace App\Http\Requests\Portal;

use App\Models\Resident\Resident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOccupationRequest extends FormRequest
{
    /** Shared with the portal route, which first checks the account is linked to a record. */
    public static function fields(): array
    {
        return [
            'occupation' => ['required', 'string', Rule::in(Resident::OCCUPATIONS)],
        ];
    }

    public static function fieldMessages(): array
    {
        return [
            'occupation.in' => 'Choose one of the listed occupations.',
        ];
    }

    public function rules(): array
    {
        return self::fields();
    }

    public function messages(): array
    {
        return self::fieldMessages();
    }
}
