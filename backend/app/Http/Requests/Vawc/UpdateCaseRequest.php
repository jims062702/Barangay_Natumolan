<?php

namespace App\Http\Requests\Vawc;

use App\Models\Resident\Resident;
use App\Models\Vawc\CaseFile;
use App\Services\Vawc\VawcComplainant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            // A mis-picked survivor has to be correctable, or the case has to
            // be deleted and re-filed — losing the whole audit trail with it.
            // Re-linked to somebody else, it is to a woman (VawcComplainant);
            // a case opened before that rule saves as it is.
            'survivor_id' => ['sometimes', 'exists:residents,id', function (string $attribute, $value, $fail) {
                $case = $this->route('case');
                if ($case instanceof CaseFile && (int) $case->survivor_id === (int) $value) {
                    return;
                }
                $survivor = Resident::find($value);
                if ($survivor && ($refusal = VawcComplainant::deskRefusal($survivor))) {
                    $fail($refusal);
                }
            }],
            'reported_by_type' => ['sometimes', Rule::in(CaseFile::REPORTER_TYPES)],
            'reported_by_name' => 'nullable|string|max:150',
            'reported_by_resident_id' => 'nullable|exists:residents,id',
            'reported_by_relationship' => 'nullable|string|max:100',
            'reported_by_contact' => 'nullable|string|max:50',
            /* The WIDE list here: a case filed before the intake form
               changed still has to be saveable as what it is. */
            'violence_type' => 'in:' . implode(',', CaseFile::VIOLENCE_TYPES),
            'violence_types' => 'sometimes|array|min:1',
            'violence_types.*' => 'in:' . implode(',', CaseFile::VIOLENCE_TYPES),
            'violence_acts' => 'nullable|array',
            'violence_acts.*' => 'in:' . implode(',', CaseFile::allViolenceActs()),
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
            /* "Update Safety Assessment" on the case. */
            'currently_in_danger' => ['sometimes', 'nullable', Rule::in(CaseFile::DANGER_ANSWERS)],
            'protection_needed' => ['sometimes', 'nullable', Rule::in(['Yes', 'No'])],
            'risk_level' => ['sometimes', 'nullable', Rule::in(CaseFile::RISK_LEVELS)],
        ];
    }
}
