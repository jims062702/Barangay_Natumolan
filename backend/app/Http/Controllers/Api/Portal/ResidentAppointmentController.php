<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;
use App\Models\Council\Appointment;
use Illuminate\Http\Request;

class ResidentAppointmentController extends BaseController
{
    /**
     * Get appointments for the authenticated resident.
     */
    public function index()
    {
        $user = auth()->user();
        if (!$user->resident_id) {
            return $this->forbidden('Not a registered resident portal user.');
        }

        $appointments = Appointment::where('resident_id', $user->resident_id)
            ->with(['approver:id,name', 'canceller:id,name'])
            ->orderByDesc('appointment_date')
            ->orderByDesc('id')
            ->get();

        return $this->success($appointments, 'Resident appointments retrieved');
    }

    /**
     * Check which time slots are already booked and approved on a specific date.
     */
    public function bookedSlots(Request $request)
    {
        $request->validate(['date' => 'required|date']);

        $booked = Appointment::whereDate('appointment_date', $request->date)
            ->whereIn('status', ['Approved', 'Completed'])
            ->pluck('appointment_time')
            ->map(fn ($t) => trim((string) $t))
            ->filter()
            ->unique()
            ->values();

        return $this->success([
            'date' => $request->date,
            'booked_slots' => $booked,
            'booked_times' => $booked,
        ], 'Booked slots retrieved');
    }

    /**
     * Resident books an appointment via their portal dashboard.
     */
    public function store(Request $request)
    {
        $user = auth()->user();
        if (!$user->resident_id) {
            return $this->forbidden('Not a registered resident portal user.');
        }

        $resident = $user->resident;

        $validated = $request->validate([
            'appointment_date' => 'required|date|after_or_equal:today',
            'appointment_time' => 'required|string|max:20',
            'purpose' => 'required|string|max:255',
            'phone_number' => 'required|string|max:25',
            'email' => 'required|email|max:50',
            'id_card_code' => 'nullable|string|max:32',
        ]);

        $appDate = $validated['appointment_date'];
        $appTime = trim($validated['appointment_time']);

        // Check if selected time slot is already taken by an Approved/Completed appointment
        $isTaken = Appointment::whereDate('appointment_date', $appDate)
            ->where('appointment_time', $appTime)
            ->whereIn('status', ['Approved', 'Completed'])
            ->exists();

        if ($isTaken) {
            return $this->error("The time slot {$appTime} on {$appDate} is already booked and approved. Please choose an available time slot.", 422);
        }

        // Check if slot is in the past or within 30 minutes for today's date
        if (\App\Http\Controllers\Api\Council\AppointmentController::isTimeSlotTooSoonOrPast($appDate, $appTime)) {
            return $this->error("Appointments scheduled for today must be booked at least 30 minutes in advance. The slot {$appTime} is no longer available.", 422);
        }

        // Prevent rapid duplicate clicks within 10 seconds
        $recent = Appointment::where('resident_id', $user->resident_id)
            ->whereDate('appointment_date', $appDate)
            ->where('appointment_time', $appTime)
            ->where('created_at', '>=', now()->subSeconds(10))
            ->first();
        if ($recent) {
            return $this->success($recent, "Appointment request {$recent->appointment_number} already submitted.");
        }

        $phone = $validated['phone_number'] ?? $resident?->contact_number ?? $user->contact_number ?? '';
        $email = $validated['email'] ?? $user->email;
        $address = $resident?->address ? ($resident->address . ', ' . ($resident->zone_purok ?? '')) : ($resident?->zone_purok ?? 'Barangay Natumolan');

        $appointment = Appointment::create([
            'appointment_number' => Appointment::nextNumber(),
            'resident_id' => $user->resident_id,
            'applicant_type' => 'Resident',
            'is_walk_in' => false,
            'full_name' => $user->name,
            'address' => $address,
            'phone_number' => $phone,
            'email' => $email,
            'appointment_date' => $appDate,
            'appointment_time' => $appTime,
            'purpose' => trim($validated['purpose']),
            'status' => 'Pending',
            'id_card_code' => $validated['id_card_code'] ?? null,
        ]);

        // 1. In-system notification to Resident
        Notification::notifyResident(
            $user->resident_id,
            'appointment_requested',
            "Appointment Requested: {$appointment->appointment_number}",
            "Your appointment request for " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " ({$appointment->appointment_time}) has been submitted. Please wait for confirmation from the Barangay.",
            'appointment',
            $appointment->id,
            '/resident/appointments'
        );

        // 2. In-system notification to Secretary
        Notification::notifySecretary(
            'new_appointment_request',
            "New Appointment Request: {$appointment->appointment_number}",
            "{$user->name} requested an appointment for '{$appointment->purpose}' on " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " ({$appointment->appointment_time}).",
            'appointment',
            $appointment->id,
            '/appointments'
        );

        return $this->success($appointment, "Appointment request {$appointment->appointment_number} submitted successfully.");
    }

    /**
     * Resident cancels their appointment online with a reason.
     */
    public function cancel(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if (!$user->resident_id || $appointment->resident_id !== $user->resident_id) {
            return $this->forbidden('You can only cancel your own appointments.');
        }

        if (!in_array($appointment->status, ['Pending', 'Approved'], true)) {
            return $this->error('Only Pending or Approved appointments can be cancelled.', 422);
        }

        $validated = $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $reason = trim($validated['reason']);
        $appointment->status = 'Cancelled';
        $appointment->cancel_reason = $reason;
        $appointment->cancelled_by = $user->id;
        $appointment->cancelled_at = now();
        $appointment->save();

        // Notify Secretary that resident cancelled
        Notification::notifySecretary(
            'appointment_cancelled',
            "Appointment Cancelled: {$appointment->appointment_number}",
            "{$user->name} cancelled their appointment for " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " ({$appointment->appointment_time}). Reason: {$reason}",
            'appointment',
            $appointment->id,
            '/appointments'
        );

        return $this->success($appointment, "Your appointment has been cancelled successfully.");
    }
}
