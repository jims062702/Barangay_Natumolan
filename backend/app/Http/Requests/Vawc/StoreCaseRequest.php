<?php

namespace App\Http\Requests\Vawc;

use App\Models\Resident\Resident;
use App\Models\Vawc\CaseFile;
use App\Services\Vawc\ProtectionOrderForm;
use App\Services\Vawc\VawcComplainant;
use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A new case at intake. Only the survivor has to be on the register.
 */
class StoreCaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            /* A woman — see VawcComplainant. Her children go on as dependents. */
            'survivor_id' => ['required', 'exists:residents,id', function (string $attribute, $value, $fail) {
                $survivor = Resident::find($value);
                if ($survivor && ($refusal = VawcComplainant::deskRefusal($survivor))) {
                    $fail($refusal);
                }
            }],
            /* Who reported it — the victim-survivor herself, or somebody
               else, named in REPORTER_TYPES. Asked outright: the checkbox it
               replaces could not say WHO the other person was. */
            'reported_by_type' => ['required', Rule::in(CaseFile::REPORTER_TYPES)],
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
             * Required: the respondent is the person reported to have
             * committed the act, and a protection order, a referral to the
             * police and every follow-up question about their whereabouts are
             * about them.
             */
            'respondent_id' => 'required|exists:residents,id|different:survivor_id',
            /*
             * ONE OR MORE KINDS, because that is the usual case.
             *
             * A woman describing a beating, the threats that came with it
             * and the wages taken off her was filed as ONE of those and the
             * desk chose; the other two went unrecorded and the quarterly
             * return under-reported them.
             *
             * THE ACTS ARE OPTIONAL. A survivor recounting what happened is
             * not filling in a checklist, and an officer who cannot find
             * the exact act must still be able to record the kind.
             */
            'violence_types' => 'required|array|min:1',
            'violence_types.*' => 'in:' . implode(',', CaseFile::INTAKE_VIOLENCE_TYPES),
            'violence_acts' => 'nullable|array',
            'violence_acts.*' => 'in:' . implode(',', CaseFile::allViolenceActs()),
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
            /* The brief description of the reported incident, in the
               victim-survivor's own words where appropriate. */
            'incident_narrative' => 'required|string|max:10000',
            /* "Around 8:00 PM" — a victim may not know the exact time. */
            'approximate_time' => 'nullable|string|max:60',
            /*
             * The immediate safety assessment.
             *
             * "Currently in danger: Yes" makes the case Critical. "Immediate
             * protection needed: Yes" opens a protection order on the case,
             * at whatever stage it is in.
             */
            'currently_in_danger' => ['required', Rule::in(CaseFile::DANGER_ANSWERS)],
            'protection_needed' => ['required', Rule::in(['Yes', 'No'])],
            'protection_order' => ['nullable', 'array', 'required_if:protection_needed,Yes'],
            /* Asked only when protection is needed; a "No" has no order. */
            ...($this->input('protection_needed') === 'Yes' ? ProtectionOrderForm::rules('protection_order.') : []),
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
            if ($this->input('protection_needed') === 'Yes' && is_array($this->input('protection_order'))) {
                ProtectionOrderForm::checkDates($validator, $this->input('protection_order'), 'protection_order.');
            }

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

    /**
     * The order's rules apply only when protection is needed — a "No" leaves
     * the whole block out, whatever the form still held.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('protection_needed') !== 'Yes') {
            $this->getInputSource()->remove('protection_order');
        }
    }

    public function messages(): array
    {
        return [
            'violence_types.required' => 'Choose at least one kind of violence. More than one may be chosen.',
            'violence_types.min' => 'Choose at least one kind of violence. More than one may be chosen.',
            ...ProtectionOrderForm::messages('protection_order.'),
            'reported_by_type.required' => 'Say who reported the case.',
            'respondent_id.required' => 'Pick the respondent — the person reported to have committed the act.',
            'incident_narrative.required' => 'Write a brief description of the reported incident.',
            'currently_in_danger.required' => 'Answer whether the victim-survivor is currently in danger.',
            'protection_needed.required' => 'Answer whether immediate protection is needed.',
            'report_date.before_or_equal' => 'The complaint cannot be reported in the future.',
            'occurred_at.before_or_equal' => 'The incident cannot have happened in the future.',
            'respondent_id.different' => 'The respondent cannot be the same person as the victim.',
        ];
    }
}
