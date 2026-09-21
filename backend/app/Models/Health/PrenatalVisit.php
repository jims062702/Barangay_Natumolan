<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line in the midwife's running list: who came today, and what for.
 *
 * A DAY REGISTER, not a case file. `MaternalRecord` beside this holds the
 * pregnancy — registration, expected delivery, risk indicators — one row per
 * pregnancy. This is one row per VISIT, which is what gets written at the
 * table, and keeping them apart is what preserves the sequence.
 *
 * Age and zone are stored rather than read from the register, because the
 * list is read back as history: "she was 17 at this visit" is the fact that
 * mattered then, and recomputing it from today would rewrite every old line.
 */
class PrenatalVisit extends Model
{
    protected $table = 'prenatal_visits';

    protected $fillable = [
        'mother_id',
        'visit_date',
        'age',
        'zone_purok',
        'contact_number',
        'complaint',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return ['visit_date' => 'date'];
    }

    public function mother(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'mother_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
