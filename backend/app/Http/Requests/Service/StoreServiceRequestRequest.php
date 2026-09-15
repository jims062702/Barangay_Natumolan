<?php

namespace App\Http\Requests\Service;

use Illuminate\Foundation\Http\FormRequest;

class StoreServiceRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'resident_id' => 'nullable|exists:residents,id',
            'service_type' => 'required|string',
            'office' => 'required|string',
            'request_type' => 'required|in:Walk-in,Online',
            'purpose' => 'nullable|string',
        ];
    }
}
