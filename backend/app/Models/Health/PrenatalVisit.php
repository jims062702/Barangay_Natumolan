<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One prenatal record — a line of the station's prenatal register.
 *
 * The paper's columns: Date, Zone, Name, Age, WT, BP, HT, LMP, EDC, MOS,
 * Contact #. Every one is kept as it was entered — "110/70", "57.8",
 * "8 mos" — and nothing is concluded from them.
 *
 * It belongs to a PREGNANCY, not just to a mother: that is what makes
 * "Prenatal Visits" the visits of this pregnancy and not of her whole life.
 * Its visit number (#1, #2, …) is its place among that pregnancy's records
 * in date order — worked out, never typed. See PregnancyRegister.
 */
class PrenatalVisit extends Model
{
    protected $table = 'prenatal_visits';

    protected $fillable = [
        'pregnancy_id',
        'mother_id',
        'visit_date',
        'age',
        'zone_purok',
        'weight_kg',
        'blood_pressure',
        'height_cm',
        'lmp',
        'edc',
        'months_of_pregnancy',
        'contact_number',
        'complaint',
        'recorded_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date:Y-m-d',
            'lmp' => 'date:Y-m-d',
            'edc' => 'date:Y-m-d',
            'weight_kg' => 'decimal:2',
            'height_cm' => 'decimal:2',
        ];
    }

    public function pregnancy(): BelongsTo
    {
        return $this->belongsTo(MaternalRecord::class, 'pregnancy_id');
    }

    public function mother(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'mother_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
