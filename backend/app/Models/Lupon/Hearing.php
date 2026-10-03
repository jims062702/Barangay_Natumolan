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
    protected $appends = [
        'scheduled_end_at',
        'scheduled_end_at_formatted',
        'schedule_time_range',
        'past_closing',
        'minutes',
        'hearing_sequence',
        'hearing_title',
        'hearing_stage_label',
        'complainant_summons_status',
        'respondent_summons_status',
        'summons_status_summary',
        'formatted_schedule',
        'dynamic_status',
    ];

    /**
     * Sequence number of this hearing within its type on this case: 1, 2, or 3.
     */
    public function getHearingSequenceAttribute(): int
    {
        if (! $this->lupon_case_id || ! $this->scheduled_at) {
            return 1;
        }

        return (int) static::where('lupon_case_id', $this->lupon_case_id)
            ->where('hearing_type', $this->hearing_type)
            ->where(function ($q) {
                $q->where('scheduled_at', '<', $this->scheduled_at)
                    ->orWhere(function ($q2) {
                        $q2->where('scheduled_at', $this->scheduled_at)
                            ->where('id', '<=', $this->id);
                    });
            })
            ->count() ?: 1;
    }

    /**
     * Formal title: "Punong Barangay Hearing #1" or "Lupon Hearing #1"
     */
    public function getHearingTitleAttribute(): string
    {
        $prefix = $this->hearing_type === 'Mediation' ? 'Punong Barangay Hearing' : 'Lupon Hearing';
        return "{$prefix} #{$this->hearing_sequence}";
    }

    /**
     * Responsible stage name: "Punong Barangay" or "Lupon"
     */
    public function getHearingStageLabelAttribute(): string
    {
        return $this->hearing_type === 'Mediation' ? 'Punong Barangay' : 'Lupon';
    }

    /**
     * Summons status for complainant (Notice of Hearing): Issued, Prepared, or Pending
     */
    public function getComplainantSummonsStatusAttribute(): string
    {
        if ($this->summons_issued) {
            return 'Issued';
        }
        return $this->status === 'Scheduled' ? 'Prepared' : 'Pending';
    }

    /**
     * Summons status for respondent: Issued, Prepared, or Pending
     */
    public function getRespondentSummonsStatusAttribute(): string
    {
        if ($this->summons_issued) {
            return 'Issued';
        }
        return $this->status === 'Scheduled' ? 'Prepared' : 'Pending';
    }

    /**
     * General summons summary text
     */
    public function getSummonsStatusSummaryAttribute(): string
    {
        if ($this->summons_issued) {
            return 'Summons issued';
        }
        return $this->status === 'Scheduled' ? 'Summons prepared' : 'Summons pending';
    }

    /**
     * Formatted schedule with day of week (e.g. "Tuesday, 8:00 AM – 10:00 AM")
     */
    public function getFormattedScheduleAttribute(): ?string
    {
        if (! $this->scheduled_at) {
            return null;
        }

        $at = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);

        $dayName = $at->format('l');
        $range = $this->schedule_time_range ?: $at->format('g:i A');

        return "{$dayName}, {$range}";
    }

    /**
     * Dynamic status: Upcoming, Today, On-going, Completed, or Cancelled
     */
    public function getDynamicStatusAttribute(): string
    {
        if ($this->status === 'Cancelled') {
            return 'Cancelled';
        }
        if ($this->status === 'Completed') {
            return 'Completed';
        }
        if (! $this->scheduled_at) {
            return 'Upcoming';
        }

        $now = \Carbon\Carbon::parse(\App\Support\ManilaTime::now());
        $start = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);
        $end = $start->copy()->addMinutes(HearingCalendar::DURATION_MINUTES);

        // Future date
        if ($start->toDateString() > $now->toDateString()) {
            return 'Upcoming';
        }

        // Past date
        if ($start->toDateString() < $now->toDateString()) {
            return 'Completed';
        }

        // Today
        if ($now->lt($start)) {
            return 'Today';
        }

        if ($now->between($start, $end)) {
            return 'On-going';
        }

        return 'Completed';
    }

    /**
     * Alias for proceedings_notes to ensure consistent minutes property
     */
    public function getMinutesAttribute(): ?string
    {
        return $this->proceedings_notes;
    }

    /**
     * When the appointment is EXPECTED to be over: 2 hours (120 minutes) on.
     */
    public function getScheduledEndAtAttribute(): ?string
    {
        if (! $this->scheduled_at) {
            return null;
        }
        $at = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);

        return $at->copy()->addMinutes(HearingCalendar::MINUTES_PER_SITTING)->toDateTimeString();
    }

    /**
     * Formatted scheduled end time, e.g. "10:00 AM"
     */
    public function getScheduledEndAtFormattedAttribute(): ?string
    {
        if (! $this->scheduled_at) {
            return null;
        }
        $at = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);

        return $at->copy()->addMinutes(HearingCalendar::MINUTES_PER_SITTING)->format('g:i A');
    }

    /**
     * Formatted hearing time range, e.g. "8:00 AM – 10:00 AM"
     */
    public function getScheduleTimeRangeAttribute(): ?string
    {
        if (! $this->scheduled_at) {
            return null;
        }

        $at = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);

        $start = $at->format('g:i A');
        $end = $this->scheduled_end_at_formatted;

        return "{$start} – {$end}";
    }

    /**
     * Is this appointment past the hour the hall closes?
     */
    public function getPastClosingAttribute(): bool
    {
        if (! $this->scheduled_at) {
            return false;
        }
        $at = $this->scheduled_at instanceof \Carbon\Carbon
            ? $this->scheduled_at->copy()
            : \Carbon\Carbon::parse($this->scheduled_at);

        return HearingCalendar::pastClosing($at);
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
            'scheduled_at' => 'datetime:Y-m-d\TH:i:s',
            'started_at' => 'datetime:Y-m-d\TH:i:s',
            'ended_at' => 'datetime:Y-m-d\TH:i:s',
            'summons_printed_at' => 'datetime',
            'summons_served_date' => 'date:Y-m-d',
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
