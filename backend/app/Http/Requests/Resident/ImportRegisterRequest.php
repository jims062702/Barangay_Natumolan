<?php

namespace App\Http\Requests\Resident;

use Illuminate\Foundation\Http\FormRequest;

class ImportRegisterRequest extends FormRequest
{
    /** Checked after the office check, so an office that may not import is told that first. */
    public const RULES = [
        /*
         * The office exports in both formats, so it may hand either one
         * back. `mimes` checks the real content and not the extension —
         * an .xlsx is a zip, which is what Laravel calls it.
         */
        'file' => 'required|file|mimes:csv,txt,xlsx,zip|max:8192',
    ];

    public function rules(): array
    {
        return self::RULES;
    }
}
