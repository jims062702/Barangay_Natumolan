<?php

namespace App\Http\Requests\Content;

use Illuminate\Foundation\Http\FormRequest;

/** A new display order: the first id is shown first. */
class ReorderHeroSlidesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:hero_slides,id',
        ];
    }
}
