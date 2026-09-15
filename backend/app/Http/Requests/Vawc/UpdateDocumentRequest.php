<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Correct a document's particulars — its type, title, description or the
 * file reference locating the physical copy. The document itself is never
 * replaced, and the change is written to the access trail.
 */
class UpdateDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'document_type' => 'sometimes|in:Affidavit,Statement,Medical Certificate,Police Report,Photograph,Protection Order,Other',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'file_reference' => 'nullable|string|max:255',
        ];
    }
}
