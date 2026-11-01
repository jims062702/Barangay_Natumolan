<?php

namespace App\Http\Requests\Vawc;

use App\Http\Requests\Lupon\FileOnlineComplaintRequest;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\OnlineReport;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A VAWC online complaint — what it must carry, from the public page and
 * the portal alike.
 *
 * Only what the desk needs to decide how soon to act, and nothing she has
 * to know the law to answer: which kinds of harm, what happened, whether
 * she has been threatened, and whether she is in danger right now — and
 * who the respondent is, in her own words: a name, and where they live. The
 * desk finds them on the register when it verifies the complaint. How to
 * reach her is optional: she may not want to be called.
 */
class FileOnlineReportRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            /* Her Barangay Resident ID: the code its QR carries, and the picture. */
            'resident_card_code' => 'required|string|max:300',
            'valid_id' => 'required|file|mimes:' . FileOnlineComplaintRequest::CARD_MIMES . '|max:10240',

            'violence_types' => 'required|array|min:1',
            'violence_types.*' => ['string', Rule::in(CaseFile::INTAKE_VIOLENCE_TYPES)],
            'narrative' => 'required|string|min:20|max:5000',
            'occurred_on' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'place' => 'nullable|string|max:255',
            /* As she writes it — the desk finds them on the register when it verifies. */
            'respondent_name' => 'required|string|min:2|max:150',
            'respondent_address' => 'nullable|string|max:255',
            'relationship' => ['nullable', Rule::in(OnlineReport::RELATIONSHIPS)],
            'threatened' => 'required|boolean',
            'in_danger_now' => 'required|boolean',
            'safe_contact' => ['nullable', 'string', 'regex:/^\+63\d{10}$/'],
            'safe_time' => 'nullable|string|max:100',
            'evidence' => 'nullable|array|max:5',
            'evidence.*' => 'file|mimes:jpg,jpeg,png,webp,pdf|max:10240',
        ];
    }

    public function messages(): array
    {
        return [
            'resident_card_code.required' => 'Upload your Barangay Resident ID so the barangay can verify you.',
            'valid_id.required' => 'Upload your Barangay Resident ID — a photo or scan of the card, or the file downloaded from My Profile.',
            'valid_id.uploaded' => 'The ID file could not be uploaded. Please make sure the file is valid and under 10 MB.',
            'valid_id.max' => 'The ID file is too large. Keep it under 10 MB.',
            'valid_id.mimes' => 'Your Barangay Resident ID must be a picture (JPG, PNG or WEBP), so its QR code can be read.',
            'violence_types.required' => 'Choose at least one kind of harm. You may choose more than one.',
            'violence_types.min' => 'Choose at least one kind of harm. You may choose more than one.',
            'respondent_name.required' => 'Write the name of the person the complaint is about.',
            'respondent_name.min' => 'Write the name of the person the complaint is about.',
            'narrative.required' => 'Tell the VAW Desk what happened.',
            'narrative.min' => 'Tell the VAW Desk a little more about what happened.',
            'safe_contact.regex' => 'The contact number must be in the format +63 followed by 10 digits (e.g. +639123456789).',
            'evidence.max' => 'You may upload up to 5 evidence files.',
            'evidence.*.mimes' => 'Evidence files must be images or documents (JPG, PNG, WEBP, or PDF).',
            'evidence.*.uploaded' => 'One of the evidence files could not be uploaded. Please ensure each file is under 10 MB.',
            'evidence.*.max' => 'Each evidence file must not exceed 10 MB.',
            'threatened.required' => 'Answer whether you have been threatened.',
            'in_danger_now.required' => 'Answer whether you are in danger right now.',
            'occurred_on.before_or_equal' => 'The date cannot be in the future.',
        ];
    }
}
