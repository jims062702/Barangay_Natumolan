<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Account\ActivateAccountRequest;
use App\Http\Requests\Account\ChangePasswordRequest;
use App\Http\Requests\Account\CredentialsRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Services\Account\ActivationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Signing in and out, and the signed-in account's own details.
 *
 * Accounts are made by the Admin (staff) or the Population Office (residents);
 * there is intentionally no public registration.
 */
class AuthController extends BaseController
{
    public function __construct(private readonly ActivationCode $activation)
    {
    }

    public function login(CredentialsRequest $request)
    {
        $validated = $request->validated();

        /*
         * FIVE WRONG PASSWORDS, AND THE ACCOUNT WAITS FIFTEEN MINUTES
         * (2026-09-30).
         *
         * A resident's starting password is their surname and the year they
         * were born — a hundred or so guesses for anybody who knows them —
         * and nothing stopped those guesses coming as fast as a script could
         * send them.
         *
         * Counted per ACCOUNT, and only the failures: a barangay hall is one
         * IP address (see AppServiceProvider), and somebody who signs in
         * correctly has nothing counted against them.
         */
        $failures = 'login-failed:' . strtolower(trim($validated['email']));

        if (RateLimiter::tooManyAttempts($failures, 5)) {
            $minutes = max(1, (int) ceil(RateLimiter::availableIn($failures) / 60));

            return $this->error(
                'Too many incorrect passwords for this account. Try again in ' . $minutes
                    . ($minutes === 1 ? ' minute' : ' minutes') . ', or reset your password.',
                429,
            );
        }

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($failures, 15 * 60);

            throw ValidationException::withMessages([
                'email' => 'The provided credentials are invalid.',
            ]);
        }

        RateLimiter::clear($failures);

        if ($user->resident && $user->resident->isDeceased()) {
            return $this->error(
                'Your resident account has been deactivated because the resident record is marked as deceased. Please contact the Barangay Office if you believe this is incorrect.',
                403
            );
        }

        if (!$user->is_active) {
            return $this->error('User account is inactive', 403);
        }

        /*
         * A resident's portal account is created FOR them when the Population
         * Office registers them — nobody has yet proved they own the mailbox
         * it is addressed to, and the starting password (Lastname + birth year)
         * is guessable by anyone who knows them. So the first sign-in is only
         * half of it: a code goes to that address, and entering it is what
         * turns the account on. No token is issued until then.
         */
        if (!$user->isActivated()) {
            return $this->success(
                $this->activation->send($user) + ['requires_activation' => true, 'email' => $user->email],
                // The screen names the mailbox itself, in full; saying it
                // again here only gave the reader two versions to reconcile.
                'One more step: enter the 6-digit code we emailed you.'
            );
        }

        $token = $user->createToken('api_token')->plainTextToken;

        return $this->success([
            'user' => $user,
            'token' => $token,
        ], 'Login successful');
    }

    /**
     * Second half of the first sign-in: the emailed code.
     *
     * The password is presented again rather than a short-lived ticket from
     * the login step, so a stolen code on its own is worthless and the
     * endpoint tells an attacker nothing about which addresses exist.
     */
    public function activate(ActivateAccountRequest $request)
    {
        $validated = $request->validated();

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are invalid.',
            ]);
        }

        if (!$user->is_active) {
            return $this->error('User account is inactive', 403);
        }

        if ($user->isActivated()) {
            // Already done — hand over a token rather than a dead end.
            return $this->success([
                'user' => $user,
                'token' => $user->createToken('api_token')->plainTextToken,
            ], 'Your account is already activated. Signed in.');
        }

        if (!$user->hasLiveOtp()) {
            return $this->error(
                'That code has expired. We have sent you a new one.',
                410,
                $this->activation->send($user)
            );
        }

        if ($user->otp_attempts >= User::OTP_MAX_ATTEMPTS) {
            return $this->error(
                'Too many incorrect codes. Request a new one to try again.',
                429
            );
        }

        /* Held before the swap: redeeming the code moves pending_email into
           email and clears it, so afterwards there is nothing left to read. */
        $wasPending = $user->pending_email;

        if (!$user->redeemActivationOtp(trim($validated['code']))) {
            $left = max(0, User::OTP_MAX_ATTEMPTS - $user->fresh()->otp_attempts);

            return $this->error(
                'That code is not correct.' . ($left > 0 ? " You have {$left} attempt(s) left." : ' Request a new code.'),
                422
            );
        }

        /*
         * The register follows the login.
         *
         * A resident who corrected their address before activating has just
         * proved the new mailbox. Leaving the old one on their resident record
         * would have the barangay writing to an address they told us is wrong.
         */
        if ($wasPending) {
            $user->resident?->update(['email' => $wasPending]);
        }

        return $this->success([
            'user' => $user->fresh(),
            'token' => $user->createToken('api_token')->plainTextToken,
        ], 'Account activated. Welcome to the Barangay Natumolan portal!');
    }

    /** Sends another code — "I never got the email", from the sign-in page. */
    public function resendActivationCode(CredentialsRequest $request)
    {
        $validated = $request->validated();

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are invalid.',
            ]);
        }

        if ($user->isActivated()) {
            return $this->error('This account is already activated. Just sign in.', 422);
        }

        return $this->success(
            $this->activation->send($user),
            'A new code is on its way.'
        );
    }

    /**
     * "The email on my account is wrong and I cannot read the code."
     *
     * Unauthenticated on purpose, and for the one case that cannot be solved
     * any other way: an account that has never been activated has no token,
     * so its owner cannot reach the portal to correct the address — and the
     * code that would let them in is going to a mailbox they cannot open.
     * Resending it forever does not help.
     *
     * What stands in for a session is the PASSWORD, which the office gave
     * them at the counter and which nobody else has. The new address is not
     * written: it waits in `pending_email` while a code goes to it, and
     * entering that code both moves the address across and activates the
     * account. One code, because it is one question — is this mailbox yours?
     *
     * Only for accounts that are not yet activated. An activated resident
     * signs in and uses the portal's own two-step change, which is the same
     * machinery behind a session.
     */
    public function changeEmailBeforeActivation(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'new_email' => 'required|email|different:email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are invalid.',
            ]);
        }

        if ($user->isActivated()) {
            return $this->error(
                'This account is already activated. Sign in and change the email from your profile.',
                422
            );
        }

        /*
         * Free on both tables.
         *
         * Checked by hand rather than with a Rule, because the account being
         * corrected is identified by its CURRENT address — `ignore()` would
         * need the id, and reporting "already in use" for the row we are
         * about to move is the confusing answer.
         */
        $taken = User::where('email', $validated['new_email'])->where('id', '!=', $user->id)->exists()
            || Resident::where('email', $validated['new_email'])
                ->where('id', '!=', $user->resident_id)->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'new_email' => 'That email address is already in use.',
            ]);
        }

        $user->forceFill(['pending_email' => $validated['new_email']])->save();

        return $this->success(
            $this->activation->send($user) + ['pending_email' => $validated['new_email']],
            'A 6-digit code was sent to ' . $validated['new_email']
                . '. Entering it will change your sign-in email and activate your account.'
        );
    }

    public function me()
    {
        return $this->success(auth()->user(), 'Current user retrieved');
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->success(null, 'Logout successful');
    }

    public function updateProfile(UpdateProfileRequest $request)
    {
        $validated = $request->validated();

        $user = auth()->user();

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return $this->success($user, 'Profile updated successfully');
    }

    public function changePassword(ChangePasswordRequest $request)
    {
        $validated = $request->validated();

        $user = auth()->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return $this->error('Current password is incorrect', 400);
        }

        $user->update([
            'password' => Hash::make($validated['new_password']),
        ]);

        return $this->success(null, 'Password changed successfully');
    }

    public function refreshToken()
    {
        $user = auth()->user();
        $token = $user->createToken('api_token')->plainTextToken;

        return $this->success([
            'token' => $token,
        ], 'Token refreshed successfully');
    }
}
