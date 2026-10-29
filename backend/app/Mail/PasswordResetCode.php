<?php

namespace App\Mail;

use App\Models\Account\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The one-time code that lets somebody set a new password.
 *
 * Carries the plain code, which exists only for the length of this send —
 * the row stores a hash, the same as the activation code does.
 * Sent synchronously so the user receives their code immediately without queue lag.
 */
class PasswordResetCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $code,
        public int $minutes,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Barangay Natumolan password reset code: ' . $this->code);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.password-reset');
    }
}
