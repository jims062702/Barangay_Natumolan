<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;

class StoreEventRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'event_type' => 'required|in:Birth,Death,Transfer In,Transfer Out,Address Change,Household Change,Residency Status Change',
            'resident_id' => 'nullable|exists:residents,id',
            'event_date' => 'required|date',
            'description' => 'required|string',
        ];
    }
}
