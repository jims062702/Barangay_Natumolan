<?php

namespace App\Http\Requests\Service;

use Illuminate\Foundation\Http\FormRequest;

class CancelAppointmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'cancellation_reason' => 'required|string',
        ];
    }
}
