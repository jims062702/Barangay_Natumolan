<?php

namespace App\Http\Requests\Council;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/** The session record, as written and as corrected. */
class SaveSessionRequest extends FormRequest
{
    /** Shared with the update, which first checks the minutes are still open. */
    public static function fields(): array
    {
        return [
            'session_type' => 'required|in:Regular,Special',
            /* Not in the future: minutes are a record of something that
               happened, and a session nobody has held has none. */
            'session_date' => 'required|date|before_or_equal:' . ManilaTime::today(),
            'called_to_order_at' => 'nullable|date_format:H:i',
            'adjourned_at' => 'nullable|date_format:H:i|after:called_to_order_at',
            'venue' => 'nullable|string|max:150',
            'agenda' => 'nullable|string|max:5000',
            'minutes' => 'nullable|string|max:60000',
            'status' => 'required|in:Draft,For Approval',
            'attendees' => 'nullable|array|max:60',
            'attendees.*.name' => 'required|string|max:150',
            'attendees.*.position' => 'nullable|string|max:100',
            'attendees.*.attendance' => 'required|in:Present,Absent,Excused,Late',
            'attendees.*.remarks' => 'nullable|string|max:255',
        ];
    }

    public static function fieldMessages(): array
    {
        return [
            'session_date.before_or_equal' => 'A session cannot be recorded before it has been held.',
            'adjourned_at.after' => 'A session cannot adjourn before it was called to order.',
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
