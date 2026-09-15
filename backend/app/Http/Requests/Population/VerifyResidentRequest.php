<?php

namespace App\Http\Requests\Population;

use Illuminate\Foundation\Http\FormRequest;

/** One letter is enough — the counter searches as the clerk types. */
class VerifyResidentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'q' => 'required|string|min:1',
        ];
    }
}
