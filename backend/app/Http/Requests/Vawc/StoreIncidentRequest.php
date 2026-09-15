<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

class StoreIncidentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'incident_narrative' => 'required|string',
            'injury_documentation' => 'nullable|string',
            'medical_certificate_reference' => 'nullable|string',
            'police_report_reference' => 'nullable|string',
            'protection_order_filed' => 'boolean',
            'attachments_notes' => 'nullable|string',
        ];
    }
}
