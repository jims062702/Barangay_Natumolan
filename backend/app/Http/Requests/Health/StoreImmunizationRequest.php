<?php

namespace App\Http\Requests\Health;

use Illuminate\Foundation\Http\FormRequest;

class StoreImmunizationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'child_id' => 'required|exists:residents,id',
            'vaccine_name' => 'required|string',
            'vaccination_date' => 'required|date',
            'scheduled_date' => 'nullable|date',
            'lot_number' => 'nullable|string',
            'status' => 'required|in:Completed,Pending,Missed,Rescheduled',
            'notes' => 'nullable|string',
        ];
    }
}
