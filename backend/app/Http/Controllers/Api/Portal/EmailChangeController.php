<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Account\User;
use App\Services\Account\ActivationCode;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A resident changing the address they sign in with.
 *
 * TWO STEPS, ALWAYS. The address is not written when it is typed; it waits in
 * `pending_email` while a six-digit code goes TO IT, and becomes the login
 * only when that code comes back. Writing it straight in would mean a typo
 * locks the owner out of their own portal and a deliberate wrong address
 * hands a stranger the password-reset route.
 *
 * It is the same two steps whether or not the account has ever been
 * activated. Somebody who registered with the wrong address and cannot
 * receive the first code needs exactly this: point the account at an address
 * they can read, and let the code that proves it also turn the account on.
 */
class EmailChangeController extends PortalController
{
    /** Step one: take the address and send a code to it. */
    public function request(Request $request, ActivationCode $codes)
    {
        $user = $request->user();

        $validated = $request->validate([
            'email' => [
                'required',
                'email',
                /*
                 * Free on the users table, and on the register.
                 *
                 * Both, because a resident record carries the address too and
                 * the two must not end up naming different people. The user's
                 * own rows are ignored: re-entering your current address is a
                 * no-op, not a collision.
                 */
                Rule::unique('users', 'email')->ignore($user->id),
                Rule::unique('residents', 'email')->ignore($user->resident_id),
            ],
        ], [
            'email.unique' => 'That email address is already in use.',
        ]);

        if (strcasecmp($validated['email'], $user->email) === 0) {
            return $this->error('That is already your sign-in address.', 422);
        }

        $user->forceFill(['pending_email' => $validated['email']])->save();

        $result = $codes->send($user);

        return $this->success([
            'pending_email' => $user->pending_email,
            'otp_sent' => $result['otp_sent'],
            'expires_in_minutes' => $result['expires_in_minutes'],
        ], $result['otp_sent']
            ? 'A 6-digit code was sent to ' . $validated['email'] . '. Enter it to finish the change.'
            : 'The code could not be emailed just now. Try sending it again in a moment.');
    }

    /** Step two: the code comes back, so the address is theirs. */
    public function confirm(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'code' => 'required|digits:6',
        ]);

        if (! $user->pending_email) {
            return $this->error('No email change is waiting to be confirmed.', 422);
        }

        /*
         * Checked again at the last moment.
         *
         * Minutes pass between asking and confirming, and somebody else may
         * have taken the address in between. Letting it through here would
         * produce two accounts with one login, which the unique index would
         * then refuse in a way nobody could act on.
         */
        $taken = User::where('email', $user->pending_email)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($taken) {
            $user->forceFill(['pending_email' => null])->save();

            return $this->error(
                'That email address was taken while you were confirming it. Try another one.',
                422
            );
        }

        $newEmail = $user->pending_email;

        /* Moves pending_email into email, marks the mailbox verified, and
           activates the account if this was its first code. */
        if (! $user->redeemActivationOtp($validated['code'])) {
            return $this->error(
                'That code is wrong or has expired. Ask for a new one.',
                422
            );
        }

        /*
         * The register follows the login.
         *
         * The resident record carries an email of its own, and the office
         * reads it to reach people. Leaving it on the old address would mean
         * the barangay writing to a mailbox the resident has just told us
         * they no longer use.
         */
        $user->resident?->update(['email' => $newEmail]);

        return $this->success([
            'email' => $user->email,
            'activated_at' => $user->activated_at,
        ], 'Your sign-in email is now ' . $newEmail . '.');
    }

    /** Backs out of a change nobody finished. */
    public function cancel(Request $request)
    {
        $request->user()->forceFill(['pending_email' => null])->save();

        return $this->success(null, 'The email change was cancelled.');
    }
}
