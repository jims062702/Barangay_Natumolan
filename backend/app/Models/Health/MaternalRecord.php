<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One PREGNANCY — the maternal health record.
 *
 * It was one row per mother, saved over on every pregnancy, with its visit
 * count typed in by hand. Now each pregnancy is its own row, and a mother's
 * history is all of them:
 *
 *   Active      the current pregnancy — at most one per mother
 *   Delivered   completed by delivery (actual_delivery_date)
 *   Closed      completed otherwise, with the staff's own note
 *
 * WHO SHE IS comes from the register: the mother is a resident, and her
 * name, age, address, zone and contact are read from her record there.
 *
 * THE PRENATAL VISIT COUNT IS NOT STORED. It is the number of prenatal
 * records that belong to this pregnancy, counted when asked — so it cannot
 * be wrong after a refresh, on another computer, or after a record is
 * deleted. Load it with ->withCount('prenatalVisits').
 */
class MaternalRecord extends Model
{
    public const ACTIVE = 'Active';

    public const DELIVERED = 'Delivered';

    public const CLOSED = 'Closed';

    protected $table = 'maternal_health';

    protected $fillable = [
        'mother_id',
        'pregnancy_registration_date',
        'lmp',
        'expected_delivery_date',
        'actual_delivery_date',
        'risk_indicators',
        'post_natal_followup_required',
        'family_planning_method',
        'family_planning_counseling_notes',
        'maternal_immunization_received',
        'referral_to_hospital',
        'referral_reason',
        'status',
        'completed_at',
        'completed_by',
        'closure_note',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        /* Plain dates. A cast to 'date' serialises midnight UTC with a Z,
           and a browser in Manila can read that as the day before. */
        return [
            'pregnancy_registration_date' => 'date:Y-m-d',
            'lmp' => 'date:Y-m-d',
            'expected_delivery_date' => 'date:Y-m-d',
            'actual_delivery_date' => 'date:Y-m-d',
            'completed_at' => 'date:Y-m-d',
            'post_natal_followup_required' => 'boolean',
            'maternal_immunization_received' => 'boolean',
            'referral_to_hospital' => 'boolean',
        ];
    }

    public function mother(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'mother_id');
    }

    /** The prenatal records of this pregnancy — its visits. */
    public function prenatalVisits(): HasMany
    {
        return $this->hasMany(PrenatalVisit::class, 'pregnancy_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::ACTIVE);
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }

    /** Her name, from the register — the pregnancy keeps no copy of it. */
    public function motherDisplayName(): string
    {
        return (string) $this->mother?->full_name;
    }
}
