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
 * The one-time code that activates a portal account. Carries the plain code,
 * which exists only for the length of this send — the row stores a hash.
 * Sent synchronously so the user receives their code immediately without queue lag.
 */
class PortalActivationCode extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $code,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Barangay Natumolan verification code: ' . $this->code);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.portal-otp');
    }
}
