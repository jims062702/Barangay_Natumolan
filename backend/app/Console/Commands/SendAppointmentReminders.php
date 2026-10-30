<?php

namespace App\Console\Commands;

use App\Mail\AppointmentReminderMail;
use App\Models\Council\Appointment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendAppointmentReminders extends Command
{
    protected $signature = 'app:send-appointment-reminders';
    protected $description = 'Send email reminders to residents and non-residents for appointments scheduled today.';

    public function handle(): int
    {
        $today = now()->format('Y-m-d');
        $appointments = Appointment::where('status', 'Approved')
            ->whereDate('appointment_date', $today)
            ->whereNotNull('email')
            ->get();

        $this->info("Found {$appointments->count()} approved appointments for today with email.");

        foreach ($appointments as $appointment) {
            try {
                Mail::to($appointment->email)->send(new AppointmentReminderMail($appointment));
                $this->info("Sent reminder for {$appointment->appointment_number} to {$appointment->email}");
            } catch (\Throwable $e) {
                $this->error("Failed sending reminder for {$appointment->appointment_number}: " . $e->getMessage());
            }
        }

        return Command::SUCCESS;
    }
}

