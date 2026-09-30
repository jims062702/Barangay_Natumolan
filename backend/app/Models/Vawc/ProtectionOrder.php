<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A Barangay Protection Order on a case — applied for, issued, renewed.
 *
 * RA 9262 §14: a BPO is issued by the Punong Barangay, or by an available
 * Barangay Kagawad when the Punong Barangay is not, and is effective for
 * FIFTEEN DAYS. It may be issued again when it runs out, so a case can hold
 * several: each renewal is its own row, pointing at the one it renews, and
 * the history of every issuance stays readable.
 *
 * The end of the fifteen days is worked out here and never typed: a clerk
 * who counts it on their fingers is a survivor left unprotected on day 14.
 */
class ProtectionOrder extends Model
{
    protected $table = 'vawc_protection_orders';

    /** Days in effect, counting the day it is issued. */
    public const DAYS_IN_EFFECT = 15;

    public const STATUSES = [
        'Not Yet Applied', 'Application Prepared', 'Applied', 'Issued', 'Not Issued', 'Referred for TPO/PPO',
    ];

    public const ISSUERS = ['Punong Barangay', 'Barangay Kagawad'];

    protected $fillable = [
        'vawc_case_id', 'renewal_of_id', 'status', 'applied_on', 'issued_on', 'expires_on',
        'issued_by', 'issued_by_name', 'notes', 'recorded_by',
    ];

    protected $appends = ['in_effect', 'days_left'];

    protected function casts(): array
    {
        return [
            'applied_on' => 'date:Y-m-d',
            'issued_on' => 'date:Y-m-d',
            'expires_on' => 'date:Y-m-d',
            /* It names what the respondent was ordered not to do, and to whom. */
            'notes' => 'encrypted',
        ];
    }

    /** The last day in effect for an order issued on $issuedOn. */
    public static function lastDayFor(string $issuedOn): string
    {
        return Carbon::parse($issuedOn)->addDays(self::DAYS_IN_EFFECT - 1)->toDateString();
    }

    /** Today in Manila — the day the order is counted in, not the server's UTC one. */
    public static function manilaToday(): string
    {
        return ManilaTime::today();
    }

    /** Issued, and today is within its fifteen days. */
    public function getInEffectAttribute(): bool
    {
        if ($this->status !== 'Issued' || ! $this->issued_on || ! $this->expires_on) {
            return false;
        }

        $today = self::manilaToday();

        return $this->issued_on->toDateString() <= $today && $today <= $this->expires_on->toDateString();
    }

    /** Days of protection left, counting today; null when not in effect. */
    public function getDaysLeftAttribute(): ?int
    {
        return $this->in_effect
            ? (int) Carbon::parse(self::manilaToday())->diffInDays(Carbon::parse($this->expires_on->toDateString())) + 1
            : null;
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'vawc_case_id');
    }

    public function renews(): BelongsTo
    {
        return $this->belongsTo(self::class, 'renewal_of_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
