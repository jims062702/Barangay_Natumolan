<?php

namespace App\Http\Requests\Records;

use App\Models\Records\AdministrativeRecord;
use Illuminate\Foundation\Http\FormRequest;

class StoreAdministrativeRecordRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'document_type' => 'required|in:' . implode(',', AdministrativeRecord::DOCUMENT_TYPES),
            'document_number' => 'required|string|unique:administrative_records,document_number',
            'document_title' => 'required|string|max:255',
            'document_date' => 'required|date',
            'document_content' => 'required|string',
            'summary' => 'nullable|string',
            'file_reference' => 'nullable|string|max:255',
        ];
    }
}
