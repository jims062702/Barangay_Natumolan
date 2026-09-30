<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The once-per-person lines of the ITR's immunization record: newborn
 * screening, type of delivery, birth weight and length, and the free
 * "Others" and "Booster" lines. The doses themselves are ImmunizationRecord
 * rows.
 */
class ImmunizationProfile extends Model
{
    protected $table = 'immunization_profiles';

    public const DELIVERY_TYPES = ['NSVD', 'Cesarian'];

    protected $fillable = [
        'resident_id',
        'newborn_screening_date',
        'delivery_type',
        'birth_weight_kg',
        'birth_length_cm',
        'others',
        'booster',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'newborn_screening_date' => 'date',
            'birth_weight_kg' => 'decimal:2',
            'birth_length_cm' => 'decimal:1',
        ];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
