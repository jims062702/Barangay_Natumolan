<?php

namespace App\Http\Requests\Service;

use Illuminate\Foundation\Http\FormRequest;

class StoreAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'service_request_id' => 'nullable|exists:service_requests,id',
            'resident_id' => 'required|exists:residents,id',
            'office' => 'required|string',
            'scheduled_datetime' => 'required|date_format:Y-m-d H:i:s',
            'notes' => 'nullable|string',
        ];
    }
}
