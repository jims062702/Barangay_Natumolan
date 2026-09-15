<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Portal\BookAppointmentRequest;
use App\Models\Service\Appointment;
use App\Models\Service\ServiceRequest;
use App\Support\ManilaTime;
use Illuminate\Support\Carbon;

/** Appointments the resident asked for themselves. */
class AppointmentController extends PortalController
{
    public function index()
    {
        return $this->success(
            Appointment::where('resident_id', $this->residentId())
                ->orderByDesc('scheduled_datetime')
                ->paginate(15),
            'Your appointments retrieved'
        );
    }

    public function store(BookAppointmentRequest $request)
    {
        $validated = $request->validated();

        // The time is a Manila wall-clock value — validate "future" in that
        // zone so a time earlier today isn't wrongly accepted (UTC is +8h off).
        if (Carbon::parse($validated['scheduled_datetime'], ManilaTime::ZONE)->isPast()) {
            return $this->error('Please choose a date and time in the future.', 422);
        }

        if (!empty($validated['service_request_id'])) {
            $owned = ServiceRequest::where('id', $validated['service_request_id'])
                ->where('resident_id', $this->residentId())->exists();
            if (!$owned) {
                return $this->forbidden('That service request is not yours');
            }
        }

        $appointment = Appointment::create($validated + [
            'appointment_number' => Appointment::nextNumber(),
            'resident_id' => $this->residentId(),
            'status' => 'Pending',
        ]);

        return $this->success($appointment, 'Appointment requested — await confirmation', 201);
    }

    public function cancel(Appointment $appointment)
    {
        if ($appointment->resident_id !== $this->residentId()) {
            return $this->forbidden('This appointment does not belong to your account');
        }

        $appointment->update([
            'status' => 'Cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => 'Cancelled by resident via portal',
        ]);

        return $this->success($appointment, 'Appointment cancelled');
    }
}
