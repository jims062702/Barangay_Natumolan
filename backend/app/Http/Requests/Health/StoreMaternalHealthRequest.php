<?php

namespace App\Http\Requests\Health;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A pregnancy, registered or corrected — its OWN details only.
 *
 * The mother is a woman on the register (mother_id), checked by the
 * controller; her age, zone, address and contact are the register's and are
 * not asked for here. There is no visit count either: it is counted from the
 * prenatal records, and nobody types it. Its status is not set here — a
 * pregnancy is registered current, and ended through "complete".
 */
class StoreMaternalHealthRequest extends FormRequest
{
    public function rules(): array
    {
        $today = ManilaTime::today();

        return [
            'mother_id' => ($this->isMethod('post') ? 'required|' : 'prohibited|') . 'nullable|integer',
            'pregnancy_registration_date' => 'required|date|before_or_equal:' . $today,
            'lmp' => 'nullable|date|before_or_equal:pregnancy_registration_date',
            'expected_delivery_date' => 'nullable|date' . ($this->filled('lmp') ? '|after:lmp' : ''),
            'risk_indicators' => 'nullable|string|max:2000',
            'referral_to_hospital' => 'boolean',
            'referral_reason' => 'nullable|string|max:2000',
            'family_planning_method' => 'nullable|string|max:255',
            'family_planning_counseling_notes' => 'nullable|string|max:2000',
            'maternal_immunization_received' => 'boolean',
            'post_natal_followup_required' => 'boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'mother_id.required' => 'Choose the mother from the register.',
            'mother_id.prohibited' => 'A pregnancy stays with its mother; it cannot be moved to another.',
            'pregnancy_registration_date.before_or_equal' => 'The registration date cannot be in the future.',
            'lmp.before_or_equal' => 'The LMP cannot be after the registration date.',
            'expected_delivery_date.after' => 'The EDC must be after the LMP.',
        ];
    }
}
