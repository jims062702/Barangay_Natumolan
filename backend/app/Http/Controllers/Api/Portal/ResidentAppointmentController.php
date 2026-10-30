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
            ->orderByDesc('appointment_date')
            ->orderByDesc('id')
            ->get();

        return $this->success($appointments, 'Resident appointments retrieved');
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
            'purpose' => 'required|string|max:1000',
            'phone_number' => 'nullable|string|max:25',
            'email' => 'nullable|email|max:100',
            'id_card_code' => 'nullable|string|max:32',
        ]);

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
            'appointment_date' => $validated['appointment_date'],
            'appointment_time' => $validated['appointment_time'],
            'purpose' => $validated['purpose'],
            'status' => 'Pending',
            'id_card_code' => $validated['id_card_code'] ?? null,
        ]);

        // 1. In-system notification to Resident
        Notification::notifyResident(
            $user->resident_id,
            'appointment_requested',
            "Appointment Requested: {$appointment->appointment_number}",
            "Naisumite ang inyong kahilingan para sa appointment sa petsang " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . ". Hintayin ang kumpirmasyon mula sa Barangay Secretary.",
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
}

