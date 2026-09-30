<?php

namespace App\Models\Lupon;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Services\Lupon\HearingCalendar;

class Hearing extends Model
{
    protected $table = 'lupon_hearings';

    /**
     * Always sent, because every screen that shows a sitting needs them and
     * none of them should work the arithmetic out for itself.
     */
    protected $appends = ['scheduled_end_at', 'past_closing'];

    /**
     * When the appointment is EXPECTED to be over: ninety minutes on.
     *
     * Derived, never stored. It is the default slot the day is laid out
     * with, not a deadline — nothing ends, cancels or completes a sitting
     * when it passes, and `ended_at` records what actually happened.
     */
    public function getScheduledEndAtAttribute(): ?string
    {
        return $this->scheduled_at
            ? $this->scheduled_at->copy()->addMinutes(HearingCalendar::MINUTES_PER_SITTING)->toDateTimeString()
            : null;
    }

    /**
     * Is this appointment past the hour the hall closes?
     *
     * A Tuesday can be asked to hear ten cases, which no arrangement of
     * ninety-minute slots fits between eight and five. Nothing is pushed
     * into another week to tidy that up: the case keeps its day, and the
     * office is told which rows need an hour chosen by hand.
     */
    public function getPastClosingAttribute(): bool
    {
        return $this->scheduled_at ? HearingCalendar::pastClosing($this->scheduled_at) : false;
    }

    protected $fillable = [
        'lupon_case_id',
        'hearing_type',
        'scheduled_at',
        /* When it actually ran, which is not when it was set to. The
           ninety minutes are a default for laying out the day, never a
           deadline: a mediation is not cut short because a slot expired. */
        'started_at',
        'ended_at',
        'status',
        'summons_issued',
        /*
         * WHEN the summons was printed, not merely that it was.
         *
         * Left off this list it was silently dropped on every write, so the
         * column held only what the migration backfilled and every case
         * printed since read as never printed. The print register answers
         * "have the notice and the summons gone out?" from this column.
         */
        'summons_printed_at',
        'summons_served_date',
        'complainant_present',
        'respondent_present',
        'attendance_notes',
        'proceedings_notes',
        'outcome',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'summons_printed_at' => 'datetime',
            'summons_served_date' => 'date',
            'summons_issued' => 'boolean',
            'complainant_present' => 'boolean',
            'respondent_present' => 'boolean',
        ];
    }

    public function luponCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
