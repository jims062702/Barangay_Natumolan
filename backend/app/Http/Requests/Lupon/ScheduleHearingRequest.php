<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

class ScheduleHearingRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'hearing_type' => 'required|in:Mediation,Conciliation,Arbitration',
            'scheduled_at' => 'required|date|after:' . ManilaTime::now(),
            'summons_issued' => 'boolean',
        ];
    }
}
