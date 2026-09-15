<?php

namespace App\Http\Requests\Lupon;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

class RecordSummonsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'summons_issued' => 'required|boolean',
            'summons_served_date' => 'nullable|date|before_or_equal:' . ManilaTime::today(),
            'attendance_notes' => 'nullable|string',
        ];
    }
}
