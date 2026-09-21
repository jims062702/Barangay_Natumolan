<?php

namespace App\Http\Requests\Vawc;

use App\Models\Resident\Resident;
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
            /* Item 9: the circumstance of consent, when somebody applies on
               the victim's behalf. */
            'applicant_consent' => 'nullable|string|max:1000',
            /*
             * Item 4 of the protection-order application: who it is against.
             *
             * A REGISTER ID AND NOTHING ELSE, and it must belong to somebody
             * who lives here. The residence rule is in withValidator() below,
             * because `exists:residents,id` cannot express it: non-residents
             * are rows in that same table, put there so families could be
             * recorded whole.
             *
             * `different` from the survivor, because a protection order that
             * restrains the person it is meant to protect is not an order
             * anybody can serve — and the pickers on the form already exclude
             * each other, so reaching here means something bypassed them.
             *
             * Not required: a complaint is sometimes taken before the desk has
             * the respondent's details, and turning away a survivor at the
             * counter over a missing field is the worse failure. The order
             * itself cannot be drawn until it is filled in.
             */
            'respondent_id' => 'nullable|exists:residents,id|different:survivor_id',
            /* The narrow list: what the desk takes in. An older kind can
               still be read and edited on a case already filed. */
            'violence_type' => 'required|in:' . implode(',', CaseFile::INTAKE_VIOLENCE_TYPES),
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

    /**
     * The respondent has to live in Barangay Natumolan.
     *
     * A barangay protection order is issued BY this barangay AGAINST one of
     * its own. The Punong Barangay has no power over somebody who lives
     * elsewhere, and an order naming them is one nobody can serve or enforce
     * — so taking the case at all would be a promise the barangay cannot keep
     * to the person standing at the counter.
     *
     * The APPLICANT is deliberately not checked, here or anywhere. A woman
     * may apply whoever she is and wherever she lives; it is where the
     * RESPONDENT lives that decides whether this barangay may act.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $id = $this->input('respondent_id');

            if (! $id) {
                return;
            }

            $outsider = Resident::where('id', $id)
                ->where('record_type', Resident::NON_RESIDENT)
                ->value('first_name');

            if ($outsider) {
                $validator->errors()->add(
                    'respondent_id',
                    $outsider . ' is recorded as living outside Barangay Natumolan. '
                        . 'A barangay protection order can only be issued against a '
                        . 'resident of this barangay.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'report_date.before_or_equal' => 'The complaint cannot be reported in the future.',
            'occurred_at.before_or_equal' => 'The incident cannot have happened in the future.',
            'respondent_id.different' => 'The respondent cannot be the same person as the victim.',
        ];
    }
}
