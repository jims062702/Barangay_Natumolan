<?php

namespace App\Models\Council;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Account\User;
use App\Support\SequenceNumber;

/**
 * A sitting of the Sangguniang Barangay, and the minutes of it.
 *
 * The record the secretary is personally answerable for. Draft minutes are
 * not a record — they become one when the council adopts them at a later
 * session — which is why `status` is a field and not a guess from whether
 * `minutes` is filled in.
 */
class Session extends Model
{
    protected $table = 'barangay_sessions';

    protected $fillable = [
        'session_number', 'session_type', 'session_date',
        'called_to_order_at', 'adjourned_at', 'venue',
        'agenda', 'minutes', 'status', 'recorded_by', 'adopted_at',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date',
            'adopted_at' => 'datetime',
        ];
    }

    /** SB-2026-0001, numbered within the year the session was held. */
    public static function nextNumber(string $sessionDate): string
    {
        return SequenceNumber::next('barangay_sessions', 'session_number', 'SB-' . substr($sessionDate, 0, 4) . '-', 4);
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(Attendee::class, 'barangay_session_id');
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** Present or Late — somebody who was in the room when business was done. */
    public function presentCount(): int
    {
        return $this->attendees
            ->whereIn('attendance', ['Present', 'Late'])
            ->count();
    }
}
