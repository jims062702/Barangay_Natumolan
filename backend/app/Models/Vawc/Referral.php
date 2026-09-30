<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use App\Support\ManilaTime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Referral extends Model
{
    protected $table = 'vawc_referrals';

    /**
     * Where the desk refers a victim-survivor.
     *
     * "Other" is never stored as the word itself: the desk types the office's
     * name, and that name is what goes in `referral_agency`.
     */
    public const DESTINATIONS = [
        'MSWDO / CSWDO',
        'PNP Women and Children Protection Desk',
        'Health Center / Hospital',
        'PAO / Legal Assistance',
        'DSWD',
        'Shelter / Temporary Safe Accommodation',
    ];

    public const REASONS = [
        'Social welfare assessment', 'Safety/protection', 'Medical assistance', 'Psychosocial support',
        'Legal assistance', 'Child welfare/support', 'Other',
    ];

    public const URGENCIES = ['Immediate', 'Within 24 hours', 'Routine'];

    public const STATUSES = [
        'Pending', 'Accepted', 'In Progress', 'Completed', 'Unable to Reach', 'Declined by Client',
    ];

    /** The statuses that say the receiving office has taken the referral up. */
    public const ACKNOWLEDGED = ['Accepted', 'In Progress', 'Completed'];

    protected $fillable = [
        'vawc_case_id',
        'referral_agency',
        'referral_reason',
        'reason_other',
        'urgency',
        'referral_status',
        'referred_by',
        'notes',
        'receiving_person',
        'services_requested',
        'referral_date',
        'acknowledgment_date',
        'outcome',
        'followup_schedule',
        'is_completed',
    ];

    protected function casts(): array
    {
        return [
            'referral_date' => 'date:Y-m-d',
            'acknowledgment_date' => 'date:Y-m-d',
            'followup_schedule' => 'date:Y-m-d',
            'is_completed' => 'boolean',
            /* Why she was referred, in the desk's words: encrypted. */
            'notes' => 'encrypted',
        ];
    }

    /**
     * Keeps the older columns true to the status.
     *
     * `is_completed` and `acknowledgment_date` are what the desk-wide lists
     * and the report count from, so they follow the status instead of being
     * a second answer somebody has to remember to give.
     */
    protected static function booted(): void
    {
        static::saving(function (Referral $referral) {
            if (! $referral->isDirty('referral_status')) {
                return;
            }

            $referral->is_completed = $referral->referral_status === 'Completed';

            if (in_array($referral->referral_status, self::ACKNOWLEDGED, true) && ! $referral->acknowledgment_date) {
                $referral->acknowledgment_date = ManilaTime::today();
            }
        });
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by');
    }
}
