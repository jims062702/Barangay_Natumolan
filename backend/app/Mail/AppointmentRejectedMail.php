<?php

namespace App\Mail;

use App\Models\Council\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentRejectedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Appointment Update — Barangay Natumolan (' . $this->appointment->appointment_number . ')'
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.appointment-rejected');
    }
}

