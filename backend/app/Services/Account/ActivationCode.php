<?php

namespace App\Services\Account;

use App\Mail\PortalActivationCode;
use App\Models\Account\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * The code that turns a resident's portal account on.
 *
 * A mail outage must not look like a wrong password, so the failure is
 * reported as its own state and the caller can offer "send it again".
 */
final class ActivationCode
{
    /** @return array{otp_sent: bool, expires_in_minutes: int} */
    public function send(User $user): array
    {
        $code = $user->issueActivationOtp();
        $sent = true;

        try {
            /* To the address being PROVED, not to the one on record. When a
               change is pending they are different, and sending to the old
               one would confirm a mailbox nobody was asked about. */
            Mail::to($user->otpDestination())->send(new PortalActivationCode($user, $code));
        } catch (\Throwable $e) {
            $sent = false;
            Log::warning('Activation code email failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        return ['otp_sent' => $sent, 'expires_in_minutes' => User::OTP_TTL_MINUTES];
    }
}
