<?php

namespace App\Http\Requests\Chat;

use Illuminate\Foundation\Http\FormRequest;

/** One line in a conversation, from either side. */
class ChatMessageRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'body' => 'required|string|max:2000',
        ];
    }
}
