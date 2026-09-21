<?php

namespace App\Models\Health;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Models\Resident\Resident;

class Visit extends Model
{
    protected $table = 'health_visits';

    protected $fillable = [
        'patient_id',
        'visit_date',
        /* The ITR asks for a time as well: a station seeing forty people a
           day orders its own day by it. */
        'visit_time',
        'visit_reason',
        'chief_complaints',
        'temperature',
        'blood_pressure',
        'heart_rate',
        'respiratory_rate',
        'oxygen_saturation',
        'height_cm',
        'weight_kg',
        /* The prenatal half of the ITR's vital-signs block. Blank for most
           visits; for a pregnant woman these four are the examination. */
        'fundal_height_cm',
        'fetal_heart_tone',
        'age_of_gestation',
        'presentation',
        'medication',
        /* The ticked tests from the ITR's laboratory line, one per line. */
        'laboratory',
        'symptoms',
        'observations',
        'service_provider_id',
        'consultation_notes',
        'treatment_advice',
        'followup_schedule',
        'referral_recommended',
        'referral_destination',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'followup_schedule' => 'date',
            'height_cm' => 'decimal:1',
            'weight_kg' => 'decimal:2',
            'fundal_height_cm' => 'decimal:1',
            'referral_recommended' => 'boolean',
            'temperature' => 'decimal:2',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'patient_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'service_provider_id');
    }
}
