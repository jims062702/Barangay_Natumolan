<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class AssistantInquiryRequest extends FormRequest
{
    /** The widget's own limit, held here too so a script cannot go past it. */
    public const MAX_CHARS = 1000;

    public function rules(): array
    {
        return [
            'message' => 'required|string|max:' . self::MAX_CHARS,
        ];
    }
}
