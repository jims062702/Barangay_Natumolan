<?php

namespace App\Http\Requests\Chat;

/**
 * A line the RESIDENT sends: 1,000 characters, the widget's own limit.
 *
 * The Clerk's replies keep ChatMessageRequest's 2,000. A limit on what the
 * public may type is not a limit on how fully the office may answer, and a
 * Clerk explaining a requirement step by step should not be cut short by a
 * rule written for the other side of the desk.
 */
class ResidentChatMessageRequest extends ChatMessageRequest
{
    public const MAX_CHARS = 1000;

    public function rules(): array
    {
        return [
            'body' => 'required|string|max:' . self::MAX_CHARS,
        ];
    }

    public function messages(): array
    {
        return [
            'body.max' => 'Keep a message to ' . number_format(self::MAX_CHARS) . ' characters.',
        ];
    }
}
