<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The monthly blood-pressure check: a name, an age and a reading.
 *
 * Nothing else is stored because nothing else was asked for. A column nobody
 * fills makes the form longer and the record no better — and this one is
 * filled standing up, at a table, for a queue of people.
 *
 * The reading is one string ("120/80") rather than two numbers: it is read,
 * written and said as one, and splitting it would make every form two boxes
 * for no question anybody asks of it.
 */
class SeniorCheck extends Model
{
    protected $table = 'senior_checks';

    protected $fillable = [
        'senior_id',
        'check_date',
        'age',
        'blood_pressure',
        'notes',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return ['check_date' => 'date'];
    }

    public function senior(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'senior_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
