<?php

namespace App\Models\Service;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Resident\Resident;
use App\Support\SequenceNumber;

class Appointment extends Model
{
    protected $fillable = [
        'appointment_number',
        'service_request_id',
        'resident_id',

        /* A visitor the register has never heard of. One of resident_id or
           guest_name is always set; the controller is what enforces it. */
        'guest_name',
        'guest_email',
        'guest_contact',
        'purpose',
        'office',
        'scheduled_datetime',
        'status',
        'notes',
        'cancelled_at',
        'cancellation_reason',

        /* What actually happened, written by the secretary afterwards. */
        'attendance',
        'started_at',
        'ended_at',
        'minutes',
        'minuted_by',
        'minuted_at',
    ];

    protected $casts = [
        'scheduled_datetime' => 'datetime',
        'cancelled_at' => 'datetime',
        'minuted_at' => 'datetime',
    ];

    /**
     * APT-2026-00001.
     *
     * The prefix was APPT- at the counter and APT- on the portal, so the same
     * table carried two formats depending on which door the appointment came
     * through — and neither series could see the other's numbers. APT- is
     * what the existing rows hold, so APT- is what every door issues: the
     * counter, the resident portal and the public request form.
     */
    public static function nextNumber(): string
    {
        return SequenceNumber::next('appointments', 'appointment_number', 'APT-' . date('Y') . '-', 5);
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }
}
