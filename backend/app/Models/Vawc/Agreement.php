<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The one session a VAWC case gets, and what was agreed at it.
 *
 * One per case — enforced by a unique key on the table, not by this class.
 * The desk hears the parties ONCE; a second and a third sitting is mediation,
 * and mediating a VAWC matter is prohibited.
 */
class Agreement extends Model
{
    use HasFactory;

    protected $table = 'vawc_agreements';

    protected $fillable = [
        'vawc_case_id', 'session_date', 'attendees', 'discussion', 'agreement',
        'survivor_acknowledged', 'respondent_acknowledged', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date',
            'survivor_acknowledged' => 'boolean',
            'respondent_acknowledged' => 'boolean',
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
