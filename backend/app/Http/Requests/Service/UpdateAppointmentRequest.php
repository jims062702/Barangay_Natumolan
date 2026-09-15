<?php

namespace App\Http\Requests\Service;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'scheduled_datetime' => 'date_format:Y-m-d H:i:s|after:' . ManilaTime::now(),
            'notes' => 'nullable|string',
        ];
    }
}
