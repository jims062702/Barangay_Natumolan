<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class AssistantInquiryRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'message' => 'required|string|max:500',
        ];
    }
}
