<?php

namespace App\Http\Requests\Portal;

use Illuminate\Foundation\Http\FormRequest;

class BookAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'office' => 'required|in:Main Office,Population,Health Station,Lupon',
            'scheduled_datetime' => 'required|date',
            'notes' => 'nullable|string|max:500',
            'service_request_id' => 'nullable|exists:service_requests,id',
        ];
    }
}
