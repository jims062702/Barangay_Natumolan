<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\Document;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Correct a document's particulars — its type, date, title, notes or the
 * file reference locating the physical copy. The document itself is never
 * replaced, and the change is written to the access trail.
 */
class UpdateDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'document_type' => ['sometimes', Rule::in(Document::TYPES)],
            'document_date' => ['nullable', 'date', 'before_or_equal:' . ManilaTime::today()],
            'title' => ['sometimes', 'string', 'max:255'],
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
