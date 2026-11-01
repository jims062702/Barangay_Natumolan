<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Models\Resident\Resident;

class Event extends Model
{
    protected $table = 'population_events';

    protected $fillable = [
        'resident_id',
        'event_type',
        'event_date',
        'description',
        'verification_status',
        'recorded_by',
        'verification_notes',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date:Y-m-d',
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
