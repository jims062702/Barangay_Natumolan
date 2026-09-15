<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Public\RequestAppointmentRequest;
use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Service\Appointment;
use App\Support\ManilaTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

class AppointmentRequestController extends BaseController
{
    /**
     * Every visitor appointment is with the Barangay Secretary.
     *
     * The form used to ask which office, which asked somebody outside the
     * barangay to know how it is organised — and sent them to a desk that may
     * not be the one they need. The Secretary keeps the diary and refers on
     * from there, which is what happens at the counter anyway.
     *
     * The column holds the OFFICE because that is what gates the appointments
     * screen; the role below is what decides who is told.
     */
    private const APPOINTMENT_OFFICE = 'Main Office';
    private const APPOINTMENT_ROLE = 'Secretary';

    /**
     * An appointment asked for by somebody the register has never heard of.
     *
     * Open to the internet, so it is written as if it will be abused: a tight
     * throttle on the route, a phone number that must look like one, a window
     * of office days rather than any date at all, and a status of Pending
     * rather than Scheduled — the barangay decides when, and nobody books a
     * slot in the office diary by filling in a form.
     *
     * Email is optional on purpose. A phone number reaches everybody here; an
     * email address does not, and requiring one would turn people away at the
     * door for the convenience of the desk.
     */
    public function store(RequestAppointmentRequest $request)
    {
        $validated = $request->validated();

        $when = CarbonImmutable::parse($validated['scheduled_datetime'], ManilaTime::ZONE);

        /*
         * A day the office is open, in the near future.
         *
         * Not "any future date": a request for next February is not a request,
         * and a slot at two in the morning is somebody testing the form.
         */
        if ($when->isPast()) {
            return $this->error('Please choose a date and time in the future.', 422);
        }

        if ($when->gt(CarbonImmutable::now(ManilaTime::ZONE)->addMonths(2))) {
            return $this->error('Please choose a date within the next two months.', 422);
        }

        if ($when->isWeekend()) {
            return $this->error('The barangay hall is open Monday to Friday.', 422);
        }

        if ($when->hour < 8 || $when->hour >= 17) {
            return $this->error('Please choose a time between 8:00 AM and 5:00 PM.', 422);
        }

        /*
         * The same person asking twice for the same day is somebody who
         * pressed the button twice, not somebody who wants two meetings.
         */
        $already = Appointment::where('guest_contact', $validated['guest_contact'])
            ->whereDate('scheduled_datetime', $when->utc()->toDateString())
            ->whereNotIn('status', ['Cancelled'])
            ->exists();

        if ($already) {
            return $this->error('You already have a request for that day. The office will call you about it.', 422);
        }

        $appointment = Appointment::create([
            'appointment_number' => Appointment::nextNumber(),
            'guest_name' => $validated['guest_name'],
            'guest_email' => $validated['guest_email'] ?? null,
            'guest_contact' => $validated['guest_contact'],
            'purpose' => $validated['purpose'],
            'office' => self::APPOINTMENT_OFFICE,
            /* Manila in, UTC stored — the same rule the rest of the system
               follows, and the one a form posting wall-clock time breaks. */
            'scheduled_datetime' => $when->utc()->toDateTimeString(),
            /* PENDING. A request, not a booking: the office confirms it. */
            'status' => 'Pending',
        ]);

        /* The desk is told, so a request made at four does not sit unseen. */
        $this->notifyOffice($appointment);

        return $this->success([
            'appointment_number' => $appointment->appointment_number,
        ], 'Your request has been received. The barangay will call you to confirm the time.', 201);
    }

    private function notifyOffice(Appointment $appointment): void
    {
        /*
         * The Secretary keeps the diary, and the Punong Barangay oversees it.
         * Not the Clerk: certificates are their work, and a request for a
         * meeting is not one.
         */
        $ids = User::where('is_active', true)
            ->whereIn('role', [self::APPOINTMENT_ROLE, 'Punong Barangay'])
            ->pluck('id');

        Notification::notifyUsers(
            $ids,
            'appointment_request',
            'Appointment request: ' . $appointment->guest_name,
            Str::limit($appointment->purpose, 140),
            'appointment',
            $appointment->id,
        );
    }
}
