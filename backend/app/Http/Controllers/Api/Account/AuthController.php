<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Account\ActivateAccountRequest;
use App\Http\Requests\Account\ChangePasswordRequest;
use App\Http\Requests\Account\CredentialsRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Models\Account\User;
use App\Services\Account\ActivationCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'The provided credentials are invalid.',
            ]);
        }

        if (!$user->is_active) {
            return $this->error('User account is inactive', 403);
        }

        /*
         * A resident's portal account is created FOR them when the Population
         * Office registers them — nobody has yet proved they own the mailbox
         * it is addressed to, and the starting password (Lastname + MMDDYY)
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

        if (!$user->redeemActivationOtp(trim($validated['code']))) {
            $left = max(0, User::OTP_MAX_ATTEMPTS - $user->fresh()->otp_attempts);

            return $this->error(
                'That code is not correct.' . ($left > 0 ? " You have {$left} attempt(s) left." : ' Request a new code.'),
                422
            );
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
