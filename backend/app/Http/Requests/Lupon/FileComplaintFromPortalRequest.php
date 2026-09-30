<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The same complaint, filed by somebody the barangay has already identified.
 *
 * A signed-in resident does NOT retype their name, their address or their
 * birthday, and the form must not ask: those facts are on the register, the
 * Population Office keeps them current, and a resident correcting them into
 * a complaint form would put one version of their address on the case and
 * another on the register.
 *
 * The one exception is the CONTACT NUMBER (2026-09-30): it is filled in from
 * the record, and theirs to change — numbers change more often than anybody
 * tells the Population Office. It is kept on the complaint, not written back
 * to the register.
 *
 * What is still asked is the valid ID. It is not identification here — the
 * account already did that — it is what the officer at the counter holds
 * beside the person's face before the complaint is accepted, and a
 * complainant who turns up without it cannot be checked.
 *
 * @see FileOnlineComplaintRequest for the public form, which has to ask
 *      everything because it knows nobody.
 */
class FileComplaintFromPortalRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'respondent_name' => 'required|string|max:200',
            'case_classification' => 'nullable|in:' . implode(',', \App\Models\Lupon\CaseFile::NATURES),
            'respondent_address' => 'nullable|string|max:255',
            /* Filled in from the record on the page; blank keeps the record's. */
            'complainant_contact' => 'nullable|string|max:50',

            'narrative' => 'required|string|min:20|max:5000',
            'date_of_occurrence' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'place_of_occurrence' => 'nullable|string|max:255',
            'relationship_nature' => 'nullable|in:Family,Neighbor,Business,Friend,Other',

            /* Their own Barangay Resident ID: the picture, and the code its
               QR carries — checked to be valid AND theirs. */
            'resident_card_code' => 'required|string|max:300',
            'valid_id' => 'required|file|mimes:' . FileOnlineComplaintRequest::CARD_MIMES . '|max:5120',

            'evidence' => 'nullable|array|max:5',
            'evidence.*' => 'file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ];
    }

    public function messages(): array
    {
        return [
            'valid_id.required' => 'Upload your Barangay Resident ID — a photo or scan of the card, or the file downloaded from My Profile.',
            'valid_id.mimes' => 'Your Barangay Resident ID must be a picture (JPG, PNG or WEBP), so its QR code can be read.',
            'resident_card_code.required' => 'Upload your Barangay Resident ID so the barangay can verify you.',
            'valid_id.max' => 'The ID file is too large. Keep it under 5 MB.',
            'narrative.required' => 'Describe what happened.',
            'narrative.min' => 'Describe what happened in a little more detail — the office reads this before you arrive.',
            'respondent_name.required' => 'Name the person the complaint is against.',
            'date_of_occurrence.before_or_equal' => 'The date cannot be in the future.',
            'evidence.max' => 'Attach up to five files.',
        ];
    }
}
