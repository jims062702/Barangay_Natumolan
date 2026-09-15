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
