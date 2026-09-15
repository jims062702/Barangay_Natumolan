<?php

namespace App\Http\Requests\Lupon;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A complaint for the docket.
 *
 * KP venue follows the respondent's residence, so the respondent must
 * be one of ours — but the complainant need not be. Either a registry
 * link OR an external name is required, never neither.
 */
class StoreCaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'case_title' => 'required|string',
            'case_classification' => 'required|in:Assault,Theft,Property Damage,Libel,Ejectment,Debt,Family Dispute,Land Dispute,Others',
            'complainant_id' => 'nullable|required_without:complainant_name|exists:residents,id',
            'complainant_name' => 'nullable|required_without:complainant_id|string|max:150',
            'complainant_address' => 'nullable|string|max:255',
            'complainant_contact' => 'nullable|string|max:50',
            'respondent_ids' => 'required|array|min:1',
            'respondent_ids.*' => 'integer|exists:residents,id',
            'complaint_narrative' => 'required|string',
            'date_of_occurrence' => 'required|date',
            'place_of_occurrence' => 'required|string',
            'relationship_nature' => 'required|in:Family,Neighbor,Business,Friend,Other',
        ];
    }

    public function messages(): array
    {
        return [
            'complainant_id.required_without' => 'Select the complainant from the registry, or enter their name if they are not a barangay resident.',
            'complainant_name.required_without' => 'Enter the complainant’s name, or pick them from the registry.',
            'respondent_ids.required' => 'Name at least one respondent. Each must be a barangay resident — that is what gives the Lupon jurisdiction.',
        ];
    }
}
