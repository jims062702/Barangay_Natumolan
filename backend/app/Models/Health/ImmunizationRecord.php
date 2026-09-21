<?php

namespace App\Models\Health;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Models\Resident\Resident;

class ImmunizationRecord extends Model
{
    protected $fillable = [
        'child_id',
        'vaccine_name',
        'vaccination_date',
        /* What the child measured when the dose was given. A dose is judged
           against size, and a fever is why one gets deferred. */
        'height_cm',
        'weight_kg',
        'temperature',
        'scheduled_date',
        'lot_number',
        'administered_by',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'vaccination_date' => 'date',
            'scheduled_date' => 'date',
        ];
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'child_id');
    }

    public function administrator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'administered_by');
    }
}
