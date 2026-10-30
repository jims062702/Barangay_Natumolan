<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;
use App\Models\Council\Appointment;
use App\Services\Resident\ResidentCards;
use Illuminate\Http\Request;

class PublicAppointmentController extends BaseController
{
    /**
     * Book an appointment from the public landing page using Resident ID verification.
     */
    public function store(Request $request, ResidentCards $cards)
    {
        $validated = $request->validate([
            'id_card_code' => 'required|string',
            'appointment_date' => 'required|date|after_or_equal:today',
            'appointment_time' => 'required|string|max:20',
            'purpose' => 'required|string|max:1000',
            'phone_number' => 'required|string|max:25',
            'email' => 'nullable|email|max:100',
        ]);

        $verified = $cards->verify($validated['id_card_code']);
        if (($verified['status'] ?? '') !== 'verified' || empty($verified['resident'])) {
            return $this->badRequest('Invalid or unverified Barangay Resident ID. Please present a valid Resident ID card.');
        }

        $resident = $verified['resident'];
        $fullName = trim("{$resident->first_name} {$resident->middle_name} {$resident->last_name} {$resident->suffix}");
        $address = $resident->address ? ($resident->address . ', ' . ($resident->zone_purok ?? '')) : ($resident->zone_purok ?? 'Barangay Natumolan');

        $email = !empty($validated['email']) ? $validated['email'] : ($resident->email ?? null);

        $appointment = Appointment::create([
            'appointment_number' => Appointment::nextNumber(),
            'resident_id' => $resident->id,
            'applicant_type' => 'Resident',
            'is_walk_in' => false,
            'full_name' => $fullName,
            'address' => $address,
            'phone_number' => $validated['phone_number'],
            'email' => $email,
            'appointment_date' => $validated['appointment_date'],
            'appointment_time' => $validated['appointment_time'],
            'purpose' => $validated['purpose'],
            'status' => 'Pending',
            'id_card_code' => $validated['id_card_code'],
        ]);

        // In-system notification to Resident if registered
        Notification::notifyResident(
            $resident->id,
            'appointment_requested',
            "Appointment Requested: {$appointment->appointment_number}",
            "Naisumite ang inyong kahilingan para sa appointment sa petsang " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . ". Hintayin ang pagsusuri ng Barangay Secretary.",
            'appointment',
            $appointment->id,
            '/resident/appointments'
        );

        // In-system notification to Secretary
        Notification::notifySecretary(
            'new_appointment_request',
            "New Appointment Request: {$appointment->appointment_number}",
            "Resident {$fullName} requested an appointment for '{$appointment->purpose}' on " . \Carbon\Carbon::parse($appointment->appointment_date)->format('M d, Y') . " ({$appointment->appointment_time}).",
            'appointment',
            $appointment->id,
            '/appointments'
        );

        return $this->success([
            'appointment' => $appointment,
            'resident_name' => $fullName,
        ], "Your appointment request {$appointment->appointment_number} has been submitted to the Barangay Secretary.");
    }
}
