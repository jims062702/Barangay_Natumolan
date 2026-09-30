<?php

namespace App\Models\Service;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Support\SequenceNumber;

class ServiceRequest extends Model
{
    protected $fillable = [
        'request_number',
        'transaction_code',
        'resident_id',
        'service_type',
        'office',
        'request_type',
        'status',
        'purpose',
        'assigned_to',
        'completed_at',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    /**
     * REQ-2026-000001.
     *
     * Six digits, because that is what the register already holds. One door
     * padded to five and the portal's to six, which is how one series ended
     * up with REQ-2026-00038 sitting among REQ-2026-000050s — and a text
     * comparison then read the shorter one as the highest. Every door — the
     * counter, a walk-in certificate, the portal — takes its number here.
     */
    public static function nextNumber(): string
    {
        return SequenceNumber::next('service_requests', 'request_number', 'REQ-' . date('Y') . '-', 6);
    }

    /*
     * The certificates a resident asks for in one visit share a transaction
     * code. TX- and ten hex digits: random rather than counted, because a
     * counter device with no line has to be able to make one too, and a
     * random code cannot collide the way two devices' "next number" would.
     */
    public const TRANSACTION_CODE = '/^TX-[0-9A-F]{10}$/';

    public static function newTransactionCode(): string
    {
        return 'TX-' . strtoupper(bin2hex(random_bytes(5)));
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * The certificate this request produced.
     *
     * The LATEST one, explicitly. A request is meant to have exactly one —
     * filing a certificate now refuses a second — but records made
     * before that guard existed can carry two, and an unordered hasOne
     * returns whichever the database hands back first. That is how a
     * resident came to be shown "Processing" for a document released weeks
     * earlier: the abandoned first attempt happened to have the lower id.
     */
    public function certificate(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Certificate::class)->latestOfMany();
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class);
    }

    public function officeQueue(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Queue::class);
    }
}
