<?php

namespace App\Models\Lupon;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Whether a case's filing fee has been settled — Paid or not.
 *
 * NOT A CASH BOOK. The barangay takes the money at the counter and keeps its
 * own book of it; this system never touched a peso and no longer pretends to.
 * The amount, the documentary stamp and the receipt number are gone: a second
 * record of money kept by hand elsewhere is a record that disagrees with the
 * real one, and the day it disagrees somebody is accused.
 *
 * What the Lupon reads is the only thing it ever needed — the summons is
 * blocked until the fee is settled, and that is a yes or a no.
 *
 * The row survives rather than collapsing into a flag on the case because
 * "asked for, by whom, and when" is worth keeping: a complainant sent to pay
 * and then turned away needs the record to explain why.
 */
class Payment extends Model
{
    use HasFactory;

    protected $table = 'lupon_payments';

    /** The only fee there is. The CFA fee went with the certificate itself. */
    public const KIND_FILING = 'Filing';

    /** What the payer is being asked for, in words rather than pesos. */
    public const LABELS = [
        self::KIND_FILING => 'Filing fee',
    ];

    protected $fillable = [
        'lupon_case_id', 'kind', 'status',
        'requested_by', 'requested_at', 'paid_by', 'paid_at', 'notes',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    protected $appends = ['label', 'paid_by_name'];

    public function luponCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'lupon_case_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function getLabelAttribute(): string
    {
        return self::LABELS[$this->kind] ?? $this->kind;
    }

    /** Who saw the receipt and pressed Paid — shown on the case. */
    public function getPaidByNameAttribute(): ?string
    {
        return $this->paid_by ? $this->paidBy?->name : null;
    }
}
