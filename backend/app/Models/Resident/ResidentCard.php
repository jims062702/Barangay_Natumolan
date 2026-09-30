<?php

namespace App\Models\Resident;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A Barangay Resident ID, as issued — see the resident_cards migration and
 * App\Services\Resident\ResidentCards.
 */
class ResidentCard extends Model
{
    public const ACTIVE = 'Active';

    public const REVOKED = 'Revoked';

    /** Their first card. */
    public const ISSUED = 'Issued';

    /** A card in place of one they held. */
    public const REISSUED = 'Reissued';

    /** Drawn by the resident on their own portal. */
    public const VIA_PORTAL = 'Portal';

    /** Printed for them by the Population Office. */
    public const VIA_OFFICE = 'Population Office';

    protected $fillable = [
        'resident_id', 'card_no', 'token_hash', 'token', 'status', 'action', 'replaces_card_id', 'reason',
        'issued_via', 'issued_by', 'issued_at', 'revoked_at', 'revoked_by', 'revoke_reason',
    ];

    /* The code itself never leaves the model by accident. */
    protected $hidden = ['token', 'token_hash'];

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'issued_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }
}
