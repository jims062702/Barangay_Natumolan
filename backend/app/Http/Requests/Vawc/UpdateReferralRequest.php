<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A referral's response state: acknowledged, what came of it, and whether it is done.
 */
class UpdateReferralRequest extends FormRequest
{
    /** Also checked on the per-case route, after it confirms the referral is the case's. */
    public const RULES = [
        'acknowledgment_date' => 'nullable|date',
        'outcome' => 'nullable|string',
        'followup_schedule' => 'nullable|date',
        'is_completed' => 'boolean',
    ];

    public function rules(): array
    {
        return self::RULES;
    }
}
