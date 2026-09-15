<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class RequestAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'guest_name' => 'required|string|max:150',
            'guest_email' => 'nullable|email|max:150',
            /* 09xxxxxxxxx or +639xxxxxxxxx, which is every mobile in the
               country and nothing else. */
            'guest_contact' => ['required', 'string', 'max:30', 'regex:/^(09|\+639)\d{9}$/'],
            'purpose' => 'required|string|max:300',
            'scheduled_datetime' => 'required|date_format:Y-m-d H:i:s',
        ];
    }

    public function messages(): array
    {
        return [
            'guest_contact.regex' => 'Please give a mobile number as 09XXXXXXXXX.',
        ];
    }
}
