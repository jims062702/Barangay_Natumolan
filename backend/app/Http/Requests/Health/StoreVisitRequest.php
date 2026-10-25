<?php

namespace App\Http\Requests\Health;

use App\Support\ManilaTime;
use Illuminate\Foundation\Http\FormRequest;

/**
 * One consultation, as the Individual Treatment Record asks for it.
 *
 * The bounds are not decoration. A temperature of 410 is a decimal point in
 * the wrong place, a pulse of 1200 is a slipped key, and both are the kind of
 * thing that gets copied onto a referral letter and read by somebody who was
 * not in the room. Everything here is nullable — a station takes the readings
 * it can take — but nothing may be impossible.
 */
class StoreVisitRequest extends FormRequest
{
    /** The ITR's laboratory line, in the order the form prints it. */
    public const LABORATORY_TESTS = [
        'RBS/FBS', 'Stool exam', 'HBsAg', 'HIV', 'CBC', 'U/A',
        'Blood typing', 'Sputum exam', 'PT', 'VDRL', 'UTZ', 'Chest X-ray',
    ];

    public function rules(): array
    {
        return [
            'patient_id' => 'required|exists:residents,id',
            /* Recorded after the fact often enough to allow a past date, but
               never a future one — a consultation that has not happened yet
               is an appointment, and this system keeps none. */
            'visit_date' => 'required|date|before_or_equal:' . ManilaTime::now(),
            'visit_time' => ['nullable', 'regex:/^\d{1,2}:\d{2}(:\d{2})?$/'],
            'visit_reason' => 'required|string|max:255',
            'chief_complaints' => 'nullable|string',

            /* Vital signs. Human bounds, so a slipped key is caught here
               rather than on a referral letter. */
            'temperature' => 'nullable|numeric|between:25,45',
            'blood_pressure' => ['nullable', 'string', 'max:20', 'regex:/^\d{2,3}\s*\/\s*\d{2,3}$/'],
            'heart_rate' => 'nullable|integer|between:20,250',
            'respiratory_rate' => 'nullable|integer|between:5,80',
            'oxygen_saturation' => 'nullable|integer|between:50,100',
            'height_cm' => 'nullable|numeric|between:20,250',
            'weight_kg' => 'nullable|numeric|between:0.5,400',

            /* The prenatal half of the block — blank for most visits. */
            'fundal_height_cm' => 'nullable|numeric|between:5,60',
            'fetal_heart_tone' => 'nullable|integer|between:60,220',
            'age_of_gestation' => 'nullable|string|max:30',
            'presentation' => 'nullable|string|max:60',

            'symptoms' => 'nullable|string',
            'observations' => 'nullable|string',
            'consultation_notes' => 'nullable|string',
            'medication' => 'nullable|string',

            /* Ticked from the ITR's list; stored one per line. Anything not
               on the form is refused rather than silently kept, or the list
               stops being countable. */
            'laboratory' => 'nullable|array',
            'laboratory.*' => 'string|in:' . implode(',', self::LABORATORY_TESTS),

            'treatment_advice' => 'nullable|string',
            'followup_schedule' => 'nullable|date',
            'referral_recommended' => 'boolean',
            'referral_destination' => 'nullable|string|max:150',
        ];
    }

    public function messages(): array
    {
        return [
            'patient_id.required' => 'Please select a patient from the resident list first.',
            'visit_date.before_or_equal' => 'A consultation cannot be recorded in the future.',
            'blood_pressure.regex' => 'Write the reading as systolic/diastolic, e.g. 120/80.',
            'temperature.between' => 'That temperature is outside anything a person survives — check the decimal point.',
            'heart_rate.between' => 'That pulse rate is outside anything a person survives.',
            'oxygen_saturation.between' => 'O2 saturation is a percentage, so it cannot be above 100.',
        ];
    }

    /**
     * The ticked tests arrive as a LIST and are stored as LINES.
     *
     * Folded here rather than in passedValidation(): that hook merges into
     * the REQUEST, while validated() reads the validator's own copy — so the
     * controller would have gone on receiving an array and MySQL would have
     * refused it. Same shape the VAWC desk's immediate-needs list uses:
     * countable when read back, and readable on a printed record.
     */
    public function validated($key = null, $default = null)
    {
        $data = parent::validated();

        if (array_key_exists('laboratory', $data)) {
            $data['laboratory'] = collect($data['laboratory'] ?? [])
                ->filter()->unique()->values()->join("\n") ?: null;
        }

        return $key === null ? $data : data_get($data, $key, $default);
    }
}
