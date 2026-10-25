<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The one dialogue a VAWC case may have, and whether it ended in agreement.
 *
 * One per case — enforced by a unique key on the table, not by this class.
 * The desk hears the parties ONCE; a second and a third sitting is mediation,
 * and mediating a VAWC matter is prohibited.
 *
 * OPTIONAL, and never a step before protection. A case may go straight to a
 * Barangay Protection Order without any dialogue, and nothing here holds an
 * application back: RA 9262 §33 forbids the barangay from pressing a
 * victim-survivor to settle or to give up any relief she asks for.
 */
class Agreement extends Model
{
    use HasFactory;

    protected $table = 'vawc_agreements';

    public const OUTCOMES = ['Agreement reached', 'Not settled', 'No agreement'];

    protected $fillable = [
        'vawc_case_id', 'session_date', 'attendees', 'discussion', 'outcome', 'agreement', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date:Y-m-d',
            /*
             * Encrypted at rest, like the rest of this desk.
             *
             * What was discussed and what was agreed name people and describe
             * what happened to them. The key lives on the server and the
             * browser never holds it, which is also why none of this is ever
             * cached or queued offline.
             */
            'attendees' => 'encrypted',
            'discussion' => 'encrypted',
            'agreement' => 'encrypted',
        ];
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'vawc_case_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
