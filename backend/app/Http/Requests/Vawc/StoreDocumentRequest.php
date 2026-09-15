<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'document_type' => 'required|in:Affidavit,Statement,Medical Certificate,Police Report,Photograph,Protection Order,Other',
            'title' => 'required|string',
            'description' => 'nullable|string',
            'file_reference' => 'nullable|string',
        ];
    }
}
