<?php

namespace App\Http\Requests\Records;

use Illuminate\Foundation\Http\FormRequest;

class ArchiveAdministrativeRecordRequest extends FormRequest
{
    public function rules(): array
    {
        return ['is_archived' => 'required|boolean'];
    }
}
