<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\CaseFile;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // A mis-picked survivor has to be correctable, or the case has to
            // be deleted and re-filed — losing the whole audit trail with it.
            'survivor_id' => 'sometimes|exists:residents,id',
            'reported_by_name' => 'nullable|string|max:150',
            'reported_by_resident_id' => 'nullable|exists:residents,id',
            'reported_by_relationship' => 'nullable|string|max:100',
            'reported_by_contact' => 'nullable|string|max:50',
            /* The WIDE list here: a case filed before the intake form
               narrowed still has to be saveable as what it is. */
            'violence_type' => 'in:' . implode(',', CaseFile::VIOLENCE_TYPES),
            'relationship_to_offender' => 'nullable|string',
            'children_involved' => 'boolean',
            'children_count' => 'integer|min:0',
            'dependent_ids' => 'nullable|array',
            'dependent_ids.*' => 'integer|exists:residents,id',
            'children_details' => 'nullable|string',
            'immediate_needs' => 'nullable|string',
            'previous_incidents_count' => 'integer|min:0',
            'confidential_notes' => 'nullable|string',
            'status' => 'in:Active,Closed,Archived',
        ];
    }
}
