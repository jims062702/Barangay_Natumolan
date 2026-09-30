<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\Referral;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Where a referral stands: its status, what came of it, the notes.
 */
class UpdateReferralRequest extends FormRequest
{
    /** Also checked on the per-case route, after it confirms the referral is the case's. */
    public static function rulesFor(): array
    {
        return [
            'referral_status' => ['sometimes', Rule::in(Referral::STATUSES)],
            'urgency' => ['sometimes', Rule::in(Referral::URGENCIES)],
            'acknowledgment_date' => ['nullable', 'date'],
            'outcome' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'followup_schedule' => ['nullable', 'date'],
        ];
    }

    public function rules(): array
    {
        return self::rulesFor();
    }
}
