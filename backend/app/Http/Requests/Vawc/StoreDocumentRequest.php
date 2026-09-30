<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\Document;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'document_type' => ['required', Rule::in(Document::TYPES)],
            'document_date' => ['nullable', 'date', 'before_or_equal:' . ManilaTime::today()],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'file_reference' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'document_date.before_or_equal' => 'A document cannot be dated in the future.',
        ];
    }
}
