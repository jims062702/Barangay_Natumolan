<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Account\ForgotPasswordRequest;
use App\Http\Requests\Account\ResetPasswordRequest;
use App\Http\Requests\Account\VerifyResetCodeRequest;
use App\Mail\PasswordResetCode;
use App\Models\Account\User;
use App\Services\Account\PasswordCodes;
use App\Services\Account\ProgressiveLockout;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * A forgotten password, without anybody having to hold it for you.
 *
 * The barangay is moving off an arrangement where an administrator knew
 * everyone's password. Two routes replace it, and neither of them ends with a
 * person knowing a secret that is not theirs:
 *
 *   - the owner asks, and a code goes to their own email;
 *   - or they come to the Population Office counter, and a clerk sets one.
 *
 * The counter route needs no code, and that is deliberate: the resident is
 * standing there with a face and a record. Emailing a code to somebody in the
 * room to type back at the clerk proves nothing that the counter has not
 * already proved.
 */
class PasswordResetController extends BaseController
{
    public function __construct(private readonly PasswordCodes $codes)
    {
    }

    /**
     * Send a code to the address on the account.
     */
    public function forgot(ForgotPasswordRequest $request)
    {
        $validated = $request->validated();

        $email = strtolower(trim($validated['email']));

        /* Progressive lockout: 5 requests -> 15 min -> 1 hr -> 24 hrs */
        if ($remaining = ProgressiveLockout::check(ProgressiveLockout::ACTION_FORGOT_PASSWORD, $email)) {
            return $this->error(
                'Too many password reset requests for this account. Try again in ' .
                    ProgressiveLockout::formatRemaining($remaining) . '.',
                429
            );
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        /*
         * An address nobody has: count failure towards lockout, then report error.
         */
        if (! $user) {
            $failure = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_FORGOT_PASSWORD, $email, 5);
            if ($failure['locked']) {
                return $this->error(
                    'Too many password reset requests. Try again in ' .
                        ProgressiveLockout::formatRemaining($failure['seconds']) . '.',
                    429
                );
            }

            return $this->error('That email is not on any Barangay Natumolan account. Check the spelling, or ask the Population Office which address is on your record.', 404);
        }

        if (! $user->is_active) {
            return $this->error('That account is disabled. Please ask the Barangay Population Office.', 403);
        }

        if ($user->isResident() && $user->resident) {
            $age = $user->resident->birthdate?->age;
            if ($age === null || $age < 18) {
                return $this->error('The resident portal account is only for residents aged 18 and above. Password resets cannot be requested for residents aged 17 and below.', 403);
            }
        }

        /* Valid user: record request attempt towards the 5-request ladder */
        $attempt = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_FORGOT_PASSWORD, $email, 5);
        if ($attempt['locked']) {
            return $this->error(
                'Too many password reset requests. Try again in ' .
                    ProgressiveLockout::formatRemaining($attempt['seconds']) . '.',
                429
            );
        }

        $code = $this->codes->issue($email);

        try {
            Mail::to($user->email)->send(new PasswordResetCode($user, $code, PasswordCodes::TTL_MINUTES));
        } catch (\Throwable $e) {
            /*
             * The mail server being down is not something to tell the person
             * at the form, because the message would differ from the one an
             * unknown address gets — and that difference is the leak this
             * whole method avoids.
             */
            Log::warning('Password reset email failed', ['user' => $user->id]);
        }

        return $this->success(
            ['email' => $user->email],
            'A 6-digit code is on its way to ' . $user->email . '.'
        );
    }

    /**
     * Is this code right? — asked before anything is changed.
     *
     * Its own step because setting a password and proving you may is one
     * question too many for one screen: somebody who mistypes the code should
     * find that out before they have chosen a password, not after.
     *
     * The row is NOT consumed here. The code is checked again when the
     * password is actually set, so a verified step cannot be replayed into a
     * password change on its own.
     */
    public function verify(VerifyResetCodeRequest $request)
    {
        $validated = $request->validated();

        $email = strtolower(trim($validated['email']));

        if ($rejected = $this->codes->check($email, $validated['code'])) {
            return $this->error($rejected->message, $rejected->status);
        }

        return $this->success(null, 'Code accepted. Choose your new password.');
    }

    /**
     * The code, and the new password.
     */
    public function reset(ResetPasswordRequest $request)
    {
        $validated = $request->validated();

        $email = strtolower(trim($validated['email']));

        if ($rejected = $this->codes->check($email, $validated['code'])) {
            return $this->error($rejected->message, $rejected->status);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user) {
            $this->codes->forget($email);

            return $this->error('That code is not valid.', 422);
        }

        $user->setPassword($validated['password'], null);

        $this->codes->forget($email);
        ProgressiveLockout::recordSuccess(ProgressiveLockout::ACTION_LOGIN, $email);
        ProgressiveLockout::recordSuccess(ProgressiveLockout::ACTION_FORGOT_PASSWORD, $email);

        return $this->success(null, 'Your password has been changed. Sign in with it now.');
    }
}
