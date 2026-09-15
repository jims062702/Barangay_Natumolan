<?php

namespace App\Http\Requests\Lupon;

use Illuminate\Foundation\Http\FormRequest;

/** Attendance and outcome, recorded from the calendar. */
class RecordHearingOutcomeRequest extends FormRequest
{
    /** Also checked on the per-case route, after it confirms the hearing is the case's. */
    public const RULES = [
        'status' => 'required|in:Completed,Rescheduled,Cancelled,No Show',
        'complainant_present' => 'nullable|boolean',
        'respondent_present' => 'nullable|boolean',
        'attendance_notes' => 'nullable|string',
        'proceedings_notes' => 'nullable|string',
        'outcome' => 'nullable|string',
    ];

    public function rules(): array
    {
        return self::RULES;
    }
}
