<?php

namespace App\Http\Controllers\Api\Council;

use App\Http\Controllers\Api\BaseController;
use App\Mail\AppointmentApprovedMail;
use App\Models\Account\Notification;
use App\Models\Council\Appointment;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class AppointmentController extends BaseController
{
    /**
     * List appointments with pagination and filters.
     * Accessible by Secretary and Punong Barangay.
     */
    public function index(Request $request)
    {
        $query = Appointment::with(['resident:id,resident_number,first_name,middle_name,last_name,suffix,contact_number,email', 'approver:id,name']);

        if ($request->filled('status') && $request->status !== 'All') {
            $query->where('status', $request->status);
        }

        if ($request->filled('applicant_type') && $request->applicant_type !== 'All') {
            $query->where('applicant_type', $request->applicant_type);
        }

        if ($request->filled('date')) {
            $query->whereDate('appointment_date', $request->date);
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('appointment_number', 'like', "%{$s}%")
                  ->orWhere('full_name', 'like', "%{$s}%")
                  ->orWhere('email', 'like', "%{$s}%")
                  ->orWhere('phone_number', 'like', "%{$s}%")
                  ->orWhere('purpose', 'like', "%{$s}%");
            });
        }

        $appointments = $query->orderByDesc('appointment_date')->orderByDesc('id')->paginate(15);

        return $this->success($appointments, 'Appointments retrieved');
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
        $appointment->load(['resident', 'approver:id,name']);
        return $this->success($appointment, 'Appointment details retrieved');
    }

    /**
     * Walk-in appointment creation by Secretary.
     * Can be Resident or Non-resident.
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
            'email' => 'nullable|email|max:100',
            'appointment_date' => 'required|date',
            'appointment_time' => 'required|string|max:20',
            'purpose' => 'required|string|max:1000',
            'status' => 'nullable|in:Pending,Approved',
            'minutes' => 'nullable|string',
        ]);

        $status = $validated['status'] ?? 'Approved';

        $appointment = Appointment::create([
            'appointment_number' => Appointment::nextNumber(),
            'resident_id' => $validated['resident_id'] ?? null,
            'applicant_type' => $validated['applicant_type'],
            'is_walk_in' => true,
            'full_name' => $validated['full_name'],
            'address' => $validated['address'],
            'phone_number' => $validated['phone_number'],
            'email' => $validated['email'] ?? null,
            'appointment_date' => $validated['appointment_date'],
            'appointment_time' => $validated['appointment_time'],
            'purpose' => $validated['purpose'],
            'status' => $status,
            'minutes' => $validated['minutes'] ?? null,
            'approved_by' => $status === 'Approved' ? $user->id : null,
            'approved_at' => $status === 'Approved' ? now() : null,
        ]);

        if ($status === 'Approved' && !empty($appointment->email)) {
            try {
                Mail::to($appointment->email)->send(new AppointmentApprovedMail($appointment));
            } catch (\Throwable $e) {
                // Log and continue
            }
        }

        return $this->success($appointment, "Walk-in appointment {$appointment->appointment_number} recorded successfully.");
    }

    /**
     * Approve appointment by Secretary.
     */
    public function approve(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if ($user->role === 'Punong Barangay') {
            return $this->forbidden('Only the Barangay Secretary is authorized to approve appointments.');
        }

        $validated = $request->validate([
            'appointment_time' => 'required|string|max:20',
            'appointment_date' => 'nullable|date',
            'minutes' => 'nullable|string',
        ]);

        $appointment->status = 'Approved';
        $appointment->appointment_time = $validated['appointment_time'];
        if (!empty($validated['appointment_date'])) {
            $appointment->appointment_date = $validated['appointment_date'];
        }
        if (isset($validated['minutes'])) {
            $appointment->minutes = $validated['minutes'];
        }
        $appointment->approved_by = $user->id;
        $appointment->approved_at = now();
        $appointment->save();

        // 1. Notify Resident in-system if linked
        if ($appointment->resident_id) {
            Notification::notifyResident(
                $appointment->resident_id,
                'appointment_approved',
                "Appointment Approved: {$appointment->appointment_number}",
                "Ang inyong appointment para sa '{$appointment->purpose}' ay naaprubahan na para sa petsang " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " sa ganap na {$appointment->appointment_time}.",
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

        return $this->success($appointment, "Appointment {$appointment->appointment_number} has been approved.");
    }

    /**
     * Reject appointment by Secretary.
     */
    public function reject(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if ($user->role === 'Punong Barangay') {
            return $this->forbidden('Only the Barangay Secretary is authorized to reject appointments.');
        }

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:500',
        ]);

        $appointment->status = 'Rejected';
        $appointment->rejection_reason = $validated['rejection_reason'];
        $appointment->save();

        if ($appointment->resident_id) {
            Notification::notifyResident(
                $appointment->resident_id,
                'appointment_rejected',
                "Appointment Update: {$appointment->appointment_number}",
                "Paumanhin, ang inyong appointment ay hindi maaprubahan: {$appointment->rejection_reason}",
                'appointment',
                $appointment->id,
                '/resident/appointments'
            );
        }

        return $this->success($appointment, "Appointment {$appointment->appointment_number} rejected.");
    }

    /**
     * Update minutes of meeting by Secretary (PB is read-only).
     */
    public function updateMinutes(Request $request, Appointment $appointment)
    {
        $user = auth()->user();
        if ($user->role === 'Punong Barangay') {
            return $this->forbidden('Only the Barangay Secretary is authorized to record or update appointment minutes.');
        }

        $validated = $request->validate([
            'minutes' => 'required|string',
            'status' => 'nullable|in:Approved,Completed',
        ]);

        $appointment->minutes = $validated['minutes'];
        if (!empty($validated['status'])) {
            $appointment->status = $validated['status'];
        }
        $appointment->save();

        return $this->success($appointment, "Minutes recorded for appointment {$appointment->appointment_number}.");
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

