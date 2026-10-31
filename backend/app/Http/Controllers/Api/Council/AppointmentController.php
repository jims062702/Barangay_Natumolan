<?php

namespace App\Http\Controllers\Api\Council;

use App\Http\Controllers\Api\BaseController;
use App\Mail\AppointmentApprovedMail;
use App\Mail\AppointmentRejectedMail;
use App\Models\Account\Notification;
use App\Models\Council\Appointment;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AppointmentController extends BaseController
{
    /**
     * List appointments with pagination, filters, and status counts.
     * Accessible by Secretary and Punong Barangay.
     */
    public function index(Request $request)
    {
        $baseQuery = Appointment::with([
            'resident:id,resident_number,first_name,middle_name,last_name,suffix,contact_number,email',
            'approver:id,name',
            'canceller:id,name',
        ]);

        if ($request->filled('applicant_type') && $request->applicant_type !== 'All') {
            $baseQuery->where('applicant_type', $request->applicant_type);
        }

        if ($request->filled('date')) {
            $baseQuery->whereDate('appointment_date', $request->date);
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $baseQuery->where(function ($q) use ($s) {
                $q->where('appointment_number', 'like', "%{$s}%")
                  ->orWhere('full_name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone_number', 'like', "%{$s}%")
                  ->orWhere('purpose', 'like', "%{$s}%");
            });
        }

        // Status counts for tabs
        $counted = (clone $baseQuery);
        $counts = [
            'All' => (clone $counted)->count(),
            'Pending' => (clone $counted)->where('status', 'Pending')->count(),
            'Approved' => (clone $counted)->where('status', 'Approved')->count(),
            'Completed' => (clone $counted)->where('status', 'Completed')->count(),
            'Cancelled' => (clone $counted)->where('status', 'Cancelled')->count(),
            'Rejected' => (clone $counted)->where('status', 'Rejected')->count(),
        ];

        if ($request->filled('status') && $request->status !== 'All') {
            $baseQuery->where('status', $request->status);
        }

        $appointments = $baseQuery->orderByDesc('appointment_date')->orderByDesc('id')->paginate(15);

        return $this->success([
            'appointments' => $appointments,
            'counts' => $counts,
        ], 'Appointments retrieved');
    }

    /**
     * Get booked/approved time slots for a specific date to prevent double bookings.
     */
    public function bookedSlots(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'exclude_id' => 'nullable|integer',
        ]);

        $query = Appointment::whereDate('appointment_date', $request->date)
            ->whereIn('status', ['Approved', 'Completed']);

        if ($request->filled('exclude_id')) {
            $query->where('id', '!=', $request->exclude_id);
        }

        $booked = $query->pluck('appointment_time')
            ->map(fn ($t) => trim((string) $t))
            ->filter()
            ->unique()
            ->values();

        // Also count pending appointments per time slot to highlight conflicts
        $pendingQuery = Appointment::whereDate('appointment_date', $request->date)
            ->where('status', 'Pending');
        if ($request->filled('exclude_id')) {
            $pendingQuery->where('id', '!=', $request->exclude_id);
        }
        $pendingTimes = $pendingQuery->pluck('appointment_time')
            ->map(fn ($t) => trim((string) $t))
            ->filter()
            ->values();
        $pendingCounts = array_count_values($pendingTimes->all());

        return $this->success([
            'date' => $request->date,
            'booked_slots' => $booked,
            'booked_times' => $booked,
            'pending_slot_counts' => $pendingCounts,
            'pending_counts' => $pendingCounts,
        ], 'Booked slots retrieved');
    }

    /**
     * Approved appointments calendar view for Secretary & Punong Barangay.
     */
    public function calendar(Request $request)
    {
        $query = Appointment::where('status', 'Approved')
            ->select([
                'id',
                'appointment_number',
                'full_name',
                'appointment_date',
                'appointment_time',
                'purpose',
                'applicant_type',
                'status',
                'minutes',
                'phone_number',
                'email',
                'address'
            ]);

        if ($request->filled('month') && $request->filled('year')) {
            $query->whereMonth('appointment_date', $request->month)
                  ->whereYear('appointment_date', $request->year);
        }

        $appointments = $query->orderBy('appointment_date')->orderBy('appointment_time')->get();

        return $this->success($appointments, 'Calendar appointments retrieved');
    }

    /**
     * Show single appointment.
     */
    public function show(Appointment $appointment)
    {
        $appointment->load(['resident', 'approver:id,name', 'canceller:id,name']);
        return $this->success($appointment, 'Appointment details retrieved');
    }

    /**
     * Check if an appointment time slot is in the past or within 30 minutes for today's date.
     */
    public static function isTimeSlotTooSoonOrPast(string $date, string $time): bool
    {
        $aptDate = \Carbon\Carbon::parse($date)->startOfDay();
        $today = now()->startOfDay();
        if ($aptDate->isPast() && !$aptDate->isToday()) {
            return true;
        }
        if ($aptDate->isToday()) {
            try {
                $slotTime = \Carbon\Carbon::createFromFormat('Y-m-d g:i A', $date . ' ' . trim($time));
                if ($slotTime->lessThan(now()->addMinutes(30))) {
                    return true;
                }
            } catch (\Throwable) {
                $ts = strtotime($date . ' ' . trim($time));
                if ($ts && $ts < (time() + 1800)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Walk-in appointment creation by Secretary.
     * Can be Resident or Non-resident.
     * Always defaults to 'Pending' status.
     */
    public function store(Request $request)
    {
        $user = auth()->user();
        if ($user->role === 'Punong Barangay') {
            return $this->forbidden('Only the Barangay Secretary is authorized to create walk-in appointments.');
        }

        $validated = $request->validate([
            'applicant_type' => 'required|in:Resident,Non-resident',
            'resident_id' => 'nullable|required_if:applicant_type,Resident|exists:residents,id',
            'full_name' => 'required|string|max:150',
            'address' => 'required|string|max:255',
            'phone_number' => 'required|string|max:25',
            'email' => 'required|email|max:50',
            'appointment_date' => 'required|date',
            'appointment_time' => 'required|string|max:20',
            'purpose' => 'required|string|max:255',
        ]);

        // Guard against duplicate concurrent submissions within 10 seconds
        $recent = Appointment::where('full_name', trim($validated['full_name']))
            ->whereDate('appointment_date', $validated['appointment_date'])
            ->where('appointment_time', trim($validated['appointment_time']))
            ->where('created_at', '>=', now()->subSeconds(10))
            ->first();
        if ($recent) {
            return $this->success($recent, "Walk-in appointment {$recent->appointment_number} recorded successfully.");
        }

        // Check if selected slot is already taken by an Approved/Completed appointment
        $isTaken = Appointment::whereDate('appointment_date', $validated['appointment_date'])
            ->where('appointment_time', trim($validated['appointment_time']))
            ->whereIn('status', ['Approved', 'Completed'])
            ->exists();

        if ($isTaken) {
            return $this->error("The time slot {$validated['appointment_time']} on {$validated['appointment_date']} is already booked and approved. Please select an available time.", 422);
        }

        if (self::isTimeSlotTooSoonOrPast($validated['appointment_date'], $validated['appointment_time'])) {
            return $this->error("Appointments scheduled for today must be filed at least 30 minutes in advance. The slot {$validated['appointment_time']} is no longer available.", 422);
        }

        $appointment = Appointment::create([
            'appointment_number' => Appointment::nextNumber(),
            'resident_id' => $validated['resident_id'] ?? null,
            'applicant_type' => $validated['applicant_type'],
            'is_walk_in' => true,
            'full_name' => trim($validated['full_name']),
            'address' => trim($validated['address']),
            'phone_number' => trim($validated['phone_number']),
            'email' => !empty($validated['email']) ? trim($validated['email']) : null,
            'appointment_date' => $validated['appointment_date'],
            'appointment_time' => trim($validated['appointment_time']),
            'purpose' => trim($validated['purpose']),
            'status' => 'Pending',
            'minutes' => null,
            'approved_by' => null,
            'approved_at' => null,
        ]);

        // In-system notification to Punong Barangay
        Notification::notifyPunongBarangay(
            'new_walkin_appointment',
            "New Walk-In Appointment: {$appointment->appointment_number}",
            "Secretary recorded a walk-in appointment for {$appointment->full_name} on " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " ({$appointment->appointment_time}).",
            'appointment',
            $appointment->id,
            '/appointments'
        );

        return $this->success($appointment, "Walk-in appointment {$appointment->appointment_number} recorded successfully with Pending status.");
    }

    /**
     * Approve appointment by Punong Barangay or Secretary.
     * Date and time can be adjusted/confirmed during approval.
     */
    public function approve(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if (!in_array($user->role, ['Punong Barangay', 'Secretary', 'Admin'], true)) {
            return $this->forbidden('Only the Punong Barangay or Barangay Secretary can approve appointments.');
        }

        $validated = $request->validate([
            'appointment_time' => 'required|string|max:20',
            'appointment_date' => 'required|date',
        ]);

        $newDate = $validated['appointment_date'];
        $newTime = trim($validated['appointment_time']);

        // Check if time slot is in the past or within 30 minutes for today's date
        if (self::isTimeSlotTooSoonOrPast($newDate, $newTime)) {
            return $this->error("Appointments scheduled for today must be confirmed at least 30 minutes in advance. The slot {$newTime} is no longer available.", 422);
        }

        // Check if another approved/completed appointment occupies this slot
        $conflict = Appointment::whereDate('appointment_date', $newDate)
            ->where('appointment_time', $newTime)
            ->whereIn('status', ['Approved', 'Completed'])
            ->where('id', '!=', $appointment->id)
            ->first();

        if ($conflict) {
            return $this->error("The time slot {$newTime} on {$newDate} is already booked and approved for {$conflict->full_name} ({$conflict->appointment_number}). Please choose a different date or time.", 422);
        }

        $appointment->status = 'Approved';
        $appointment->appointment_date = $newDate;
        $appointment->appointment_time = $newTime;
        $appointment->approved_by = $user->id;
        $appointment->approved_at = now();
        $appointment->rejection_reason = null;
        $appointment->cancel_reason = null;
        $appointment->save();

        // 1. Notify Resident in-system if linked
        if ($appointment->resident_id) {
            Notification::notifyResident(
                $appointment->resident_id,
                'appointment_approved',
                "Appointment Approved: {$appointment->appointment_number}",
                "Your appointment for '{$appointment->purpose}' has been confirmed for " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " at {$appointment->appointment_time}.",
                'appointment',
                $appointment->id,
                '/resident/appointments'
            );
        }

        // 2. Send email notification if email exists (Resident or Non-resident)
        if (!empty($appointment->email)) {
            try {
                Mail::to($appointment->email)->send(new AppointmentApprovedMail($appointment));
            } catch (\Throwable $e) {
                // Log and continue
            }
        }

        return $this->success($appointment, "Appointment {$appointment->appointment_number} has been approved for {$newDate} at {$newTime}.");
    }

    /**
     * Reject appointment by Punong Barangay or Secretary.
     */
    public function reject(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if (!in_array($user->role, ['Punong Barangay', 'Secretary', 'Admin'], true)) {
            return $this->forbidden('Only the Punong Barangay or Barangay Secretary can reject appointments.');
        }

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:500',
        ]);

        $appointment->status = 'Rejected';
        $appointment->rejection_reason = trim($validated['rejection_reason']);
        $appointment->save();

        if ($appointment->resident_id) {
            Notification::notifyResident(
                $appointment->resident_id,
                'appointment_rejected',
                "Appointment Update: {$appointment->appointment_number}",
                "Your appointment request could not be approved: {$appointment->rejection_reason}",
                'appointment',
                $appointment->id,
                '/resident/appointments'
            );
        }

        // Send email notification to applicant if email exists (Resident or Non-resident)
        if (!empty($appointment->email)) {
            try {
                Mail::to($appointment->email)->send(new AppointmentRejectedMail($appointment));
            } catch (\Throwable $e) {
                // Log and continue
            }
        }

        return $this->success($appointment, "Appointment {$appointment->appointment_number} rejected.");
    }

    /**
     * Cancel appointment by Secretary or Punong Barangay (Walk-in or Online).
     */
    public function cancel(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if (!in_array($user->role, ['Punong Barangay', 'Secretary', 'Admin'], true)) {
            return $this->forbidden('Only the Punong Barangay or Barangay Secretary can cancel appointments.');
        }

        $reason = trim((string) ($request->input('cancel_reason') ?? $request->input('reason') ?? ''));
        if (empty($reason)) {
            return $this->error('The cancellation reason is required.', 422);
        }

        $appointment->status = 'Cancelled';
        $appointment->cancel_reason = $reason;
        $appointment->cancelled_by = $user->id;
        $appointment->cancelled_at = now();
        $appointment->save();

        if ($appointment->resident_id) {
            Notification::notifyResident(
                $appointment->resident_id,
                'appointment_cancelled',
                "Appointment Cancelled: {$appointment->appointment_number}",
                "Your appointment has been cancelled. Reason: {$reason}",
                'appointment',
                $appointment->id,
                '/resident/appointments'
            );
        }

        return $this->success($appointment, "Appointment {$appointment->appointment_number} has been cancelled.");
    }

    /**
     * Update minutes of meeting by Secretary (PB is strictly read-only).
     * Minutes can ONLY be added if appointment is on or after the scheduled date,
     * and automatically sets the appointment status to Completed.
     */
    public function updateMinutes(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if (!in_array($user->role, ['Secretary', 'Admin'], true)) {
            return $this->forbidden('Only the Barangay Secretary is authorized to record or update appointment minutes.');
        }

        if (!in_array($appointment->status, ['Approved', 'Completed'], true)) {
            return $this->error('Minutes can only be recorded for approved or completed appointments.', 422);
        }

        $aptDate = \Carbon\Carbon::parse($appointment->appointment_date)->startOfDay();
        $today = now()->startOfDay();
        if ($aptDate->isFuture()) {
            return $this->error('Minutes can only be recorded on or after the scheduled appointment date (' . $aptDate->format('M d, Y') . ').', 422);
        }

        $validated = $request->validate([
            'minutes' => 'required|string',
        ]);

        $appointment->minutes = trim($validated['minutes']);
        $appointment->status = 'Completed';
        $appointment->save();

        return $this->success($appointment, "Minutes recorded and appointment {$appointment->appointment_number} marked as completed.");
    }

    /**
     * Delete appointment by Secretary.
     */
    public function destroy(Appointment $appointment)
    {
        $user = auth()->user();
        if ($user->role === 'Punong Barangay') {
            return $this->forbidden('Only the Barangay Secretary is authorized to delete appointments.');
        }

        $num = $appointment->appointment_number;
        $appointment->delete();

        return $this->success(null, "Appointment {$num} deleted successfully.");
    }
}
