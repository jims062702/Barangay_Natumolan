<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

class RescheduleHearingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'scheduled_at' => 'required|date|after:' . ManilaTime::now(),
            'reason' => 'nullable|string',
        ];
    }
}
