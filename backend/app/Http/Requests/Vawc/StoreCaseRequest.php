<?php

namespace App\Http\Requests\Vawc;

use App\Models\Vawc\CaseFile;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A new case at intake. Only the survivor has to be on the register.
 */
class StoreCaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'survivor_id' => 'required|exists:residents,id',
            // The person who brought the complaint. Not required to be a
            // resident — only the survivor is. Blank means the survivor
            // reported it herself.
            'reported_by_name' => 'nullable|string|max:150',
            'reported_by_resident_id' => 'nullable|exists:residents,id',
            'reported_by_relationship' => 'nullable|string|max:100',
            'reported_by_contact' => 'nullable|string|max:50',
            'violence_type' => 'required|in:Physical,Psychological,Economic,Sexual,Mixed',
            'relationship_to_offender' => 'nullable|string',
            'children_involved' => 'boolean',
            'children_count' => 'integer|min:0',
            // Which residents the dependents are. The count is derived from
            // this, never typed, so the two can never disagree.
            'dependent_ids' => 'nullable|array',
            'dependent_ids.*' => 'integer|exists:residents,id',
            'children_details' => 'nullable|string',
            /*
             * Needs as a list rather than a paragraph.
             *
             * Free text could not be counted, so nobody could answer "how
             * many survivors this quarter needed shelter?" — which is the
             * question a barangay budget is built on. Stored in the same
             * encrypted column: what somebody needs says what happened to
             * them.
             */
            'immediate_needs' => 'nullable|array',
            'immediate_needs.*' => 'string|max:120',
            'immediate_needs_other' => 'nullable|string|max:255',
            'previous_incidents_count' => 'integer|min:0',
            'confidential_notes' => 'nullable|string',
            'incident_narrative' => 'nullable|string',
            /*
             * When and where it happened, and whether it still is.
             *
             * The form recorded only when the complaint was MADE. A
             * prescription period runs from the act, and an officer deciding
             * whether to go out tonight needs to know whether the person
             * complained of is in the house right now.
             */
            'occurred_at' => 'nullable|date|before_or_equal:' . ManilaTime::now(),
            'incident_location' => 'nullable|string|max:255',
            'is_ongoing' => 'nullable|boolean',
            'offender_nearby' => 'nullable|boolean',
            'risk_level' => 'nullable|in:' . implode(',', CaseFile::RISK_LEVELS),
            'reporting_channel' => 'nullable|string|max:60',
            // A case is often encoded after the fact, so the desk may set the
            // actual date and time the complaint was made — never the future.
            'report_date' => 'nullable|date|before_or_equal:' . ManilaTime::now(),
        ];
    }

    public function messages(): array
    {
        return [
            'report_date.before_or_equal' => 'The complaint cannot be reported in the future.',
            'occurred_at.before_or_equal' => 'The incident cannot have happened in the future.',
        ];
    }
}
