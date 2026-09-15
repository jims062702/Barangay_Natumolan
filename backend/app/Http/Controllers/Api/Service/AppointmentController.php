<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Service\CancelAppointmentRequest;
use App\Http\Requests\Service\StoreAppointmentRequest;
use App\Http\Requests\Service\UpdateAppointmentRequest;
use App\Models\Service\Appointment;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Appointments at the office: booked, confirmed, moved, minuted, cancelled. */
class AppointmentController extends BaseController
{
    public function index(Request $request)
    {
        $query = Appointment::with(['resident', 'serviceRequest']);

        if ($request->has('office')) {
            $query->where('office', $request->office);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            $query->whereDate('scheduled_datetime', $request->date);
        }

        $appointments = $query->orderBy('scheduled_datetime', 'asc')->paginate(20);

        return $this->success($appointments, 'Appointments retrieved');
    }

    public function store(StoreAppointmentRequest $request)
    {
        $validated = $request->validated();

        // Manila wall-clock time — validate "future" in that zone (UTC is +8h off).
        if (Carbon::parse($validated['scheduled_datetime'], ManilaTime::ZONE)->isPast()) {
            return $this->error('Please choose a date and time in the future.', 422);
        }

        $validated['appointment_number'] = Appointment::nextNumber();
        $validated['status'] = 'Scheduled';

        $appointment = Appointment::create($validated);

        return $this->success($appointment, 'Appointment created', 201);
    }

    public function show(Appointment $appointment)
    {
        $appointment->load(['resident', 'serviceRequest']);

        return $this->success($appointment, 'Appointment retrieved');
    }

    public function confirm(Appointment $appointment)
    {
        // Resident-booked appointments arrive as "Pending"; staff-created ones
        // as "Scheduled". Either can be confirmed.
        if (! in_array($appointment->status, ['Pending', 'Scheduled'], true)) {
            return $this->error('Only pending or scheduled appointments can be confirmed', 400);
        }

        $appointment->update(['status' => 'Confirmed']);

        return $this->success($appointment, 'Appointment confirmed');
    }

    public function cancel(CancelAppointmentRequest $request, Appointment $appointment)
    {
        $validated = $request->validated();

        $appointment->update([
            'status' => 'Cancelled',
            'cancelled_at' => now(),
            'cancellation_reason' => $validated['cancellation_reason'],
        ]);

        return $this->success($appointment, 'Appointment cancelled');
    }

    public function update(UpdateAppointmentRequest $request, Appointment $appointment)
    {
        $appointment->update($request->validated());

        return $this->success($appointment, 'Appointment updated');
    }

    /**
     * Attendance, the real times, and the minutes.
     *
     * The secretary's act, and gated to them at the route. `attendance` is
     * deliberately not `status`: an appointment can be Completed with nobody
     * present — the office did its part and the resident did not come — and
     * collapsing the two would lose exactly the fact worth recording.
     */
    public function minutes(Request $request, Appointment $appointment)
    {
        if ($appointment->status === 'Cancelled') {
            return $this->error('A cancelled appointment has no minutes.', 422);
        }

        $validated = $request->validate([
            'attendance' => 'required|in:Awaiting,Present,Absent,Late',
            /* Times on the day it was booked for, so no date to disagree. */
            'started_at' => 'nullable|date_format:H:i',
            'ended_at' => 'nullable|date_format:H:i|after:started_at',
            'minutes' => 'nullable|string|max:20000',
        ], [
            'ended_at.after' => 'An appointment cannot end before it started.',
        ]);

        /*
         * Nobody came, so there is no time it ran and nothing to minute.
         * Left to the form this becomes a record of a meeting that says it
         * started at nine and that the resident was absent.
         */
        if ($validated['attendance'] === 'Absent') {
            $validated['started_at'] = null;
            $validated['ended_at'] = null;
        }

        $validated['minuted_by'] = auth()->id();
        $validated['minuted_at'] = now();

        $appointment->update($validated);

        return $this->success($appointment->fresh(), 'Minutes recorded');
    }

    public function destroy(Appointment $appointment)
    {
        if ($appointment->status === 'Completed') {
            return $this->error('Completed appointments cannot be deleted', 400);
        }

        $appointment->delete();

        return $this->success(null, 'Appointment deleted');
    }
}
