<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * What a complaint begun over the web has to carry.
 *
 * THE VALID ID IS THE POINT OF THIS FORM'S STRICTNESS. Anything the public
 * can post to can be posted to by a script, and a Lupon docket filling with
 * invented disputes would cost the office more than the form saves. A
 * photograph of an identity document is not proof — the office still looks
 * at the person and the card together at the counter — but it is a cost
 * that a script will not pay and a real complainant will.
 *
 * THE EVIDENCE IS OPTIONAL, deliberately and always. Somebody with a
 * photograph of the moved fence should be able to send it. Somebody
 * standing in a corridor with a borrowed phone should not be stopped from
 * reporting anything at all.
 *
 * Nothing validated here makes a case. It makes a reference number.
 */
class FileOnlineComplaintRequest extends FormRequest
{
    /** What a person may hand over as identification. */
    public const ID_TYPES = [
        'PhilSys / National ID', 'Driver\'s Licence', 'Passport', 'SSS / GSIS / UMID',
        'PhilHealth ID', 'Voter\'s ID', 'Postal ID', 'Senior Citizen ID', 'PWD ID',
        'Barangay ID', 'Company / School ID', 'Other government-issued ID',
    ];

    /**
     * What a RESIDENT files with: their Barangay Resident ID. Set by the
     * server once the card's code has been checked — never chosen from the
     * list above, which is for people who do not live here.
     */
    public const RESIDENT_CARD = 'Barangay Resident ID';

    /** A resident's ID is read for its QR code, so it has to be a picture. */
    public const CARD_MIMES = 'jpg,jpeg,png,webp';

    public function rules(): array
    {
        $resident = $this->input('filer_kind') === 'Resident';

        return [
            'filer_kind' => 'required|in:Resident,Non-resident',

            /*
             * Who is complaining.
             *
             * A NON-RESIDENT types their own details. A RESIDENT does not:
             * they are identified by their Barangay Resident ID — the code
             * its QR carries, read from the picture they upload and checked
             * against the register (ResidentCards) — and their name and
             * address are then read off their record. A resident id is never
             * taken from the request: whoever could send one could file as
             * anybody.
             */
            'complainant_name' => ($resident ? 'nullable' : 'required') . '|string|max:200',
            'complainant_address' => ($resident ? 'nullable' : 'required') . '|string|max:255',
            'complainant_contact' => 'required|string|max:50',
            'resident_card_code' => ($resident ? 'required' : 'prohibited') . '|string|max:300',

            'respondent_name' => 'required|string|max:200',
            /* Nature of the Case, as the complainant sees it — optional; the
               Lupon confirms or changes it when it accepts the complaint. */
            'case_classification' => 'nullable|in:' . implode(',', \App\Models\Lupon\CaseFile::NATURES),
            'respondent_address' => 'nullable|string|max:255',

            'narrative' => 'required|string|min:20|max:5000',
            'date_of_occurrence' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'place_of_occurrence' => 'nullable|string|max:255',
            'relationship_nature' => 'nullable|in:Family,Neighbor,Business,Friend,Other',

            'valid_id_type' => $resident ? 'nullable' : 'required|in:' . implode(',', self::ID_TYPES),
            'valid_id_number' => [
                'nullable',
                'string',
                'max:80',
                function ($attribute, $value, $fail) {
                    $idType = $this->input('valid_id_type');
                    $val = trim((string) $value);
                    if ($val === '') return;

                    switch ($idType) {
                        case 'PhilSys / National ID':
                            if (!ctype_digit($val) || strlen($val) !== 16) {
                                $fail('PhilSys / National ID number must be exactly 16 numeric digits.');
                            }
                            break;
                        case 'PhilHealth ID':
                            if (!ctype_digit($val) || strlen($val) !== 12) {
                                $fail('PhilHealth ID number must be exactly 12 numeric digits.');
                            }
                            break;
                        case 'SSS / GSIS / UMID':
                            if (!ctype_digit($val) || strlen($val) < 10 || strlen($val) > 12) {
                                $fail('SSS / GSIS / UMID number must be 10 to 12 numeric digits.');
                            }
                            break;
                        case "Driver's Licence":
                            if (!preg_match('/^[A-Za-z0-9]{11}$/', $val)) {
                                $fail('Driver\'s Licence number must be exactly 11 alphanumeric characters.');
                            }
                            break;
                        case 'Passport':
                            if (!preg_match('/^[A-Za-z0-9]{9}$/', $val)) {
                                $fail('Passport number must be exactly 9 alphanumeric characters.');
                            }
                            break;
                        case "Voter's ID":
                            if (!ctype_digit($val) || strlen($val) !== 12) {
                                $fail('Voter\'s ID number must be exactly 12 numeric digits.');
                            }
                            break;
                        case 'Postal ID':
                            if (!preg_match('/^[A-Za-z0-9]{16}$/', $val)) {
                                $fail('Postal ID number must be exactly 16 characters.');
                            }
                            break;
                    }
                },
            ],
            /* An image or a PDF, and small enough that a phone on barangay
               data can actually send it. A resident's is their card, read for
               its QR, so theirs must be a picture. */
            'valid_id' => 'required|file|mimes:' . ($resident ? self::CARD_MIMES : 'jpg,jpeg,png,webp,pdf') . '|max:5120',

            'evidence' => 'nullable|array|max:5',
            'evidence.*' => 'file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ];
    }

    public function messages(): array
    {
        return [
            'valid_id.required' => $this->input('filer_kind') === 'Resident'
                ? 'Upload your Barangay Resident ID — a photo or scan of the card, or the file downloaded from My Profile.'
                : 'Attach a photograph of a valid ID. The office checks it against you at the counter.',
            'valid_id.mimes' => $this->input('filer_kind') === 'Resident'
                ? 'Your Barangay Resident ID must be a picture (JPG, PNG or WEBP), so its QR code can be read.'
                : 'The ID must be a photograph (JPG, PNG or WEBP) or a PDF.',
            'resident_card_code.required' => 'Upload your Barangay Resident ID so the barangay can verify you.',
            'resident_card_code.prohibited' => 'A Barangay Resident ID is only for residents. Choose "Yes, I am a resident here" if you live in Barangay Natumolan.',
            'valid_id.max' => 'The ID file is too large. Keep it under 5 MB.',
            'narrative.required' => 'Describe what happened.',
            'narrative.min' => 'Describe what happened in a little more detail — the office reads this before you arrive.',
            'respondent_name.required' => 'Name the person the complaint is against.',
            'date_of_occurrence.before_or_equal' => 'The date cannot be in the future.',
            'evidence.max' => 'Attach up to five files.',
        ];
    }
}
