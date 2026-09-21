<?php

namespace App\Http\Requests\Portal;

use App\Models\Resident\Resident;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The few things on a resident's record that are theirs to correct.
 *
 * Everything else on the register — a name, a birthdate, a household — is
 * changed at the Population Office, where there is a document to check it
 * against. These three are different: they are facts about the person that
 * only the person knows, that change without any paperwork, and that the
 * office would otherwise learn only by asking.
 *
 *   occupation      what they do now, which changes with the season.
 *   civil status    a marriage or a bereavement they are not obliged to
 *                   report to the barangay before it is true.
 *   contact number  the one the office rings when a certificate is ready.
 *                   A stale one is worse than none: it silently fails.
 *
 * Every field is `sometimes`, so a page that changes one does not have to
 * resend the other two — and a field left out is left alone rather than
 * blanked.
 */
class UpdateOwnDetailsRequest extends FormRequest
{
    /** Shared with the portal route, which first checks the account is linked to a record. */
    public static function fields(): array
    {
        return [
            'occupation' => ['sometimes', 'required', 'string', Rule::in(Resident::OCCUPATIONS)],
            'civil_status' => ['sometimes', 'nullable', 'string', Rule::in(Resident::CIVIL_STATUSES)],
            /*
             * Nullable, because "I have no number" is a real answer and the
             * office should be able to read it as one rather than as a
             * number nobody has typed yet.
             */
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:20'],
        ];
    }

    public static function fieldMessages(): array
    {
        return [
            'occupation.in' => 'Choose one of the listed occupations.',
            'civil_status.in' => 'Choose one of the listed civil statuses.',
            'contact_number.max' => 'A contact number cannot be longer than 20 characters.',
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
