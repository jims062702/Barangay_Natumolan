<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\Referral;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A referral from the desk.
 *
 * `referral_agency` is one of the listed destinations, or — for "Other" —
 * the name the desk typed. Never the word "Other" itself: a referral to
 * "Other" tells whoever reads the case nothing about where she was sent.
 */
class StoreReferralRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'referral_agency' => ['required', 'string', 'max:80', Rule::notIn(['Other'])],
            'referral_reason' => ['required', Rule::in(Referral::REASONS)],
            'reason_other' => ['nullable', 'string', 'max:150', 'required_if:referral_reason,Other'],
            'urgency' => ['required', Rule::in(Referral::URGENCIES)],
            'referral_date' => ['required', 'date', 'before_or_equal:' . ManilaTime::today()],
            'referral_status' => ['required', Rule::in(Referral::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'referral_agency.not_in' => 'Type the name of the office the victim-survivor is referred to.',
            'reason_other.required_if' => 'Say what the referral is for.',
            'referral_date.before_or_equal' => 'A referral cannot be dated in the future.',
        ];
    }
}
