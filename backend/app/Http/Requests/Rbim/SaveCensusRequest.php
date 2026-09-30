<?php

namespace App\Http\Requests\Rbim;

use App\Models\Rbim\Census;
use App\Models\Rbim\CensusMember;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The RBIM census form, as typed in from the paper sheet.
 *
 * The rules and messages are static because the census routes check the
 * office first and validate afterwards, so an office that does not collect
 * the census is told that rather than what is wrong with the form.
 */
class SaveCensusRequest extends FormRequest
{
    /**
     * Validation for the whole form.
     *
     * Almost everything is nullable on purpose. A census is filled in at a
     * doorstep, sometimes over two visits, and a form that refuses to save
     * until every box is answered is a form that gets finished on paper and
     * never keyed in at all. What IS required is what makes the record
     * identifiable: a household head and a name on every line.
     */
    /**
     * `$draft` — the form is still a Draft (a new one always is).
     *
     * A draft is saved as it is typed (the form saves itself, 2026-09-29),
     * so it must be savable before the household head or a line's surname
     * has been reached: refusing it would lose the answers above them on a
     * refresh. Registering (Submit) still refuses a head or a line with no
     * name — see CensusRegistration — and a SUBMITTED census keeps them
     * required, because people on the register came from it.
     */
    public static function fields(?int $ignoreId = null, bool $draft = false): array
    {
        $named = $draft ? 'nullable' : 'required';

        /*
         * 99 is an answer, not a gap.
         *
         * The form says it in its own margin: "For SKIPPED questions, write
         * 99" — and then names exactly when. Q11 is 99 for a four-year-old;
         * Q12 to Q14 are 99 below three and at twenty-five and over. It is
         * the paper's way of saying "asked, does not apply", which is a
         * different fact from a box nobody filled in, and the register has
         * to be able to hold both.
         */
        $in = fn (array $list) => 'nullable|integer|in:99,' . implode(',', array_keys($list));

        return [
            /*
             * Unique, now that a clerk types it.
             *
             * The number is copied off the paper, and the paper number is
             * what identifies the sheet when somebody goes looking for the
             * physical form. Two records sharing one makes that lookup
             * ambiguous, and nothing else on a census tells them apart.
             */
            'census_no' => [
                'nullable', 'string', 'max:20',
                Rule::unique('rbim_censuses', 'census_no')->ignore($ignoreId),
            ],
            'is_institutional' => 'boolean',

            /* A. Identification */
            'province' => 'nullable|string|max:100',
            'city_municipality' => 'nullable|string|max:100',
            'barangay' => 'nullable|string|max:100',
            // Not on the paper form. Every resident record carries a purok
            // and the sheet has nowhere to write one.
            'zone_purok' => 'nullable|string|max:100',
            'address_unit' => 'nullable|string|max:150',
            'address_house_lot' => 'nullable|string|max:150',
            'address_street' => 'nullable|string|max:150',
            'respondent_name' => 'nullable|string|max:150',
            'household_head_name' => $named . '|string|max:150',
            'total_members' => 'nullable|integer|min:0|max:99',
            'household_id' => 'nullable|exists:households,id',

            /* H. Household questions */
            'q45_housing_tenure' => $in(Census::TENURES),
            'q46_lot_tenure' => $in(Census::TENURES),
            'q47_lighting_fuel' => $in(Census::LIGHTING_FUELS),
            'q47_other' => 'nullable|string|max:100',
            'q48_cooking_fuel' => $in(Census::COOKING_FUELS),
            'q48_other' => 'nullable|string|max:100',
            'q49_water_source' => $in(Census::WATER_SOURCES),
            'q49_other' => 'nullable|string|max:100',
            'q50a_garbage_disposal' => $in(Census::GARBAGE_DISPOSAL),
            'q50b_segregates' => $in(Census::YES_NO),
            'q51_toilet' => $in(Census::TOILETS),
            'q51_other' => 'nullable|string|max:100',
            'q52_building_type' => $in(Census::BUILDING_TYPES),
            'q53_outer_wall' => $in(Census::OUTER_WALLS),
            'q53_other' => 'nullable|string|max:100',
            /*
             * Four lists. Capped at twenty each — not because a household
             * could not answer more, but because an unbounded array from the
             * browser is a way to fill a column with rubbish.
             */
            'q54_female_deaths' => 'nullable|array|max:20',
            'q54_female_deaths.*.age' => 'nullable|integer|min:0|max:120',
            'q54_female_deaths.*.cause' => 'nullable|string|max:150',
            'q55_child_deaths' => 'nullable|array|max:20',
            'q55_child_deaths.*.age' => 'nullable|integer|min:0|max:5',
            'q55_child_deaths.*.sex' => $in(CensusMember::SEXES),
            'q55_child_deaths.*.cause' => 'nullable|string|max:150',
            'q56_common_diseases' => 'nullable|array|max:20',
            'q56_common_diseases.*' => 'nullable|string|max:120',
            'q57_primary_needs' => 'nullable|array|max:20',
            'q57_primary_needs.*' => 'nullable|string|max:120',
            'q58_intend_barangay' => 'nullable|string|max:100',
            'q58_intend_municipality' => 'nullable|string|max:100',
            'q58_intend_province' => 'nullable|string|max:100',

            'consent_given' => 'boolean',
            'consent_name' => 'nullable|string|max:150',

            /* C. Encoding */
            'date_encoded' => 'nullable|date',
            'encoder_name' => 'nullable|string|max:150',
            'supervisor_name' => 'nullable|string|max:150',
            'notes' => 'nullable|string',

            /* The member grid */
            'members' => 'nullable|array|max:30',
            'members.*.line_no' => 'nullable|integer|min:1|max:30',
            'members.*.last_name' => $named . '|string|max:100',
            'members.*.first_name' => $named . '|string|max:100',
            'members.*.middle_name' => 'nullable|string|max:100',
            /*
             * Not on the paper form. A portal account is issued against an
             * email address and against nothing else, so a household typed
             * in entirely from a census would otherwise come out with nobody
             * able to sign in.
             */
            'members.*.email' => 'nullable|email|max:150',
            'members.*.contact_number' => 'nullable|string|max:40',
            'members.*.q2_relationship' => $in(CensusMember::RELATIONSHIPS),
            'members.*.q3_sex' => $in(CensusMember::SEXES),
            'members.*.q4_age' => 'nullable|integer|min:0|max:130',
            /* Q5 — the date of birth. The month and year below are filled
               in from it when the form is saved (CensusController). */
            'members.*.q5_birthdate' => 'nullable|date_format:Y-m-d|after_or_equal:1900-01-01|before_or_equal:today',
            'members.*.q5_birth_month' => 'nullable|integer|min:1|max:12',
            'members.*.q5_birth_year' => 'nullable|integer|min:1900|max:' . date('Y'),
            // Whether this line becomes a resident record when the form is
            // submitted. Line 1 is the head and is registered regardless.
            'members.*.register_as_resident' => 'nullable|boolean',
            'members.*.q6_birthplace' => 'nullable|string|max:150',
            'members.*.q7_nationality' => $in(CensusMember::NATIONALITIES),
            'members.*.q7_nationality_other' => 'nullable|string|max:100',
            'members.*.q8_marital_status' => $in(CensusMember::MARITAL_STATUSES),
            'members.*.q9_religion' => 'nullable|string|max:100',
            'members.*.q10_ethnicity' => 'nullable|string|max:100',
            'members.*.q11_education' => $in(CensusMember::EDUCATION_LEVELS),
            'members.*.q12_enrolled' => $in(CensusMember::ENROLLMENT),
            'members.*.q13_school_level' => $in(CensusMember::SCHOOL_LEVELS),
            'members.*.q14_school_place' => 'nullable|string|max:150',
            // A census answer about the resident, not barangay money.
            'members.*.q15_monthly_income' => 'nullable|numeric|min:0|max:999999999999',
            'members.*.q16_income_source' => $in(CensusMember::INCOME_SOURCES),
            'members.*.q17_work_status' => $in(CensusMember::WORK_STATUSES),
            'members.*.q18_work_place' => 'nullable|string|max:150',
            'members.*.q19_delivery_place' => $in(CensusMember::DELIVERY_PLACES),
            'members.*.q19_other' => 'nullable|string|max:100',
            'members.*.q20_birth_attendant' => $in(CensusMember::BIRTH_ATTENDANTS),
            'members.*.q20_other' => 'nullable|string|max:100',
            'members.*.q21_immunization' => 'nullable|string|max:120',
            'members.*.q22_pregnancies' => 'nullable|integer|min:0|max:30',
            'members.*.q22_living_children' => 'nullable|integer|min:0|max:30',
            'members.*.q23_fp_method' => $in(CensusMember::FP_METHODS),
            'members.*.q24_fp_source' => $in(CensusMember::FP_SOURCES),
            'members.*.q24_other' => 'nullable|string|max:100',
            'members.*.q25_fp_intention' => $in(CensusMember::YES_NO),
            'members.*.q25_detail' => 'nullable|string|max:150',
            'members.*.q26_health_insurance' => $in(CensusMember::HEALTH_INSURANCE),
            'members.*.q26_other' => 'nullable|string|max:100',
            'members.*.q27_facility_visited' => $in(CensusMember::FACILITIES),
            'members.*.q27_other' => 'nullable|string|max:100',
            'members.*.q28_visit_reason' => $in(CensusMember::VISIT_REASONS),
            'members.*.q28_other' => 'nullable|string|max:100',
            'members.*.q29_disability' => $in(CensusMember::DISABILITIES),
            'members.*.q30_solo_parent' => $in(CensusMember::SOLO_PARENT),
            'members.*.q31_senior_registered' => $in(CensusMember::YES_NO),
            'members.*.q32_voter_barangay' => 'nullable|string|max:100',
            'members.*.q33_residence_5yrs' => 'nullable|string|max:150',
            'members.*.q34_residence_6mos' => 'nullable|string|max:150',
            'members.*.q35_stay_years' => 'nullable|integer|min:0|max:130',
            'members.*.q35_stay_months' => 'nullable|integer|min:0|max:11',
            'members.*.q36_resident_type' => $in(CensusMember::RESIDENT_TYPES),
            'members.*.q37_transfer_month' => 'nullable|integer|min:1|max:12',
            'members.*.q37_transfer_year' => 'nullable|integer|min:1900|max:' . date('Y'),
            'members.*.q38a_leave_reason' => $in(CensusMember::LEAVE_REASONS),
            'members.*.q38b_leave_reason' => $in(CensusMember::LEAVE_REASONS),
            'members.*.q38c_leave_reason' => $in(CensusMember::LEAVE_REASONS),
            'members.*.q38_other' => 'nullable|string|max:120',
            'members.*.q39_will_return' => $in(CensusMember::YES_NO),
            'members.*.q39_when' => 'nullable|string|max:60',
            'members.*.q40a_transfer_reason' => $in(CensusMember::TRANSFER_REASONS),
            'members.*.q40b_transfer_reason' => $in(CensusMember::TRANSFER_REASONS),
            'members.*.q40c_transfer_reason' => $in(CensusMember::TRANSFER_REASONS),
            'members.*.q40_other' => 'nullable|string|max:120',
            'members.*.q41_intends_to_stay' => $in(CensusMember::YES_NO),
            'members.*.q41_until' => 'nullable|string|max:60',
            'members.*.q42a_has_ctc' => $in(CensusMember::YES_NO),
            'members.*.q42b_ctc_here' => $in(CensusMember::YES_NO),
            'members.*.q43_training_interest' => $in(CensusMember::TRAININGS),
            'members.*.q43_other' => 'nullable|string|max:120',
            'members.*.q44_skill' => $in(CensusMember::SKILLS),
            'members.*.q44_other' => 'nullable|string|max:120',
            'members.*.notes' => 'nullable|string',
        ];
    }

    public static function fieldMessages(): array
    {
        return [
            'census_no.unique' => 'That form number is already on another census. '
                . 'Check the number printed on the paper sheet.',
        ];
    }

    public function rules(): array
    {
        return self::fields($this->route('rbimCensus')?->id);
    }

    public function messages(): array
    {
        return self::fieldMessages();
    }
}
