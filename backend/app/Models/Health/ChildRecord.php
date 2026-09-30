<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One weighing of one child — a line of their growth history.
 *
 * It was one row per child, replaced on every visit, so the February weight
 * erased January's. Now every measurement is its own row with its own date,
 * and a child's history is all of them, newest first.
 *
 * The child is a resident: who they are — name, birth date, sex, parents —
 * is read from the register, where the Population Office keeps it.
 *
 * The nutritional status is the one the health worker CHOSE, from the
 * station's own list. Nothing here works it out from the weight and height.
 */
class ChildRecord extends Model
{
    protected $table = 'child_health';

    /** The station's own list — the options the form has always offered. */
    public const NUTRITIONAL_STATUSES = ['Normal', 'Underweight', 'Severely Underweight', 'Overweight', 'Stunted'];

    protected $fillable = [
        'child_id',
        'record_date',
        'birth_date',
        'birth_weight',
        'fully_immunized_status',
        'current_weight',
        'current_height',
        'nutritional_status',
        'growth_monitoring_notes',
        'vitamin_services_received',
        'breastfeeding_status',
        'feeding_counseling_notes',
        'referral_needed',
        'referral_destination',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'record_date' => 'date:Y-m-d',
            'birth_date' => 'date:Y-m-d',
            'vitamin_services_received' => 'boolean',
            'referral_needed' => 'boolean',
            'birth_weight' => 'decimal:2',
            'current_weight' => 'decimal:2',
            'current_height' => 'decimal:2',
        ];
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'child_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
