<?php

namespace App\Mail;

use App\Models\Council\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: Your Barangay Appointment is Today at ' . ($this->appointment->appointment_time ?: 'Scheduled Time')
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.appointment-reminder');
    }
}
