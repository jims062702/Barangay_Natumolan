<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Account\ChangeOwnPasswordRequest;
use App\Mail\PasswordResetCode;
use App\Services\Account\PasswordCodes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Changing a password you still know, from inside the account.
 *
 * The portal's own "change my password", and it asks for two things: the
 * current password AND a code emailed to the account's address.
 *
 * Both, not either. The code alone would mean a borrowed unlocked phone is
 * enough — the mail app is on the same phone. The current password alone
 * was the old rule, and it is the rule that lets somebody who watched you
 * type it change it out from under you.
 *
 * It is a route of its own rather than a new rule on auth/change-password,
 * and the reason is concrete: every staff address in this barangay is
 * still @natumolan.local, which no mail server will ever deliver to.
 * Requiring a code there would lock nine offices out of their own
 * passwords. When those become real mailboxes, the two routes become one.
 */
class PasswordChangeController extends BaseController
{
    public function __construct(private readonly PasswordCodes $codes)
    {
    }

    /**
     * Sends the code to the signed-in account's own address.
     *
     * No email parameter — the address is the one on the account. Accepting
     * one would let a signed-in resident aim a code at an address they chose.
     */
    public function requestCode(Request $request)
    {
        $user = $request->user();

        if (! $user->email) {
            return $this->error('There is no email address on your account, so a code cannot be sent. Please ask the Population Office.', 422);
        }

        $code = $this->codes->issue(strtolower(trim($user->email)));

        try {
            Mail::to($user->email)->send(new PasswordResetCode($user, $code, PasswordCodes::TTL_MINUTES));
        } catch (\Throwable $e) {
            Log::warning('Change-password code email failed', ['user' => $user->id]);

            /*
             * Said out loud here, unlike the forgotten-password route.
             *
             * That one stays quiet so it cannot be used to discover which
             * addresses exist. There is nothing to discover here — this is
             * the signed-in owner asking about their own address — so the
             * useful answer is the honest one: the mail did not go.
             */
            return $this->error('The code could not be emailed right now. Please try again shortly.', 500);
        }

        return $this->success(
            ['email' => $user->email],
            'A 6-digit code is on its way to ' . $user->email . '.'
        );
    }

    /**
     * The current password, the code, and the new password.
     */
    public function change(ChangeOwnPasswordRequest $request)
    {
        $validated = $request->validated();

        $user = $request->user();

        /*
         * The password first, and the code second.
         *
         * Checking the code first would spend one of five attempts on
         * somebody who simply mistyped their old password, and throw away a
         * code that was never wrong.
         */
        if (! Hash::check($validated['current_password'], $user->password)) {
            return $this->error('That is not your current password.', 400);
        }

        $email = strtolower(trim((string) $user->email));

        if ($rejected = $this->codes->check($email, $validated['code'])) {
            return $this->error($rejected->message, $rejected->status);
        }

        $this->codes->forget($email);

        $user->setPassword($validated['new_password'], $user->id);

        /*
         * A fresh token, because setPassword revoked every one of them —
         * which is the point: a password changed after a phone went missing
         * has fixed nothing if the session on that phone survives it. The
         * device doing the changing gets to stay signed in; the rest do not.
         */
        return $this->success(
            ['token' => $user->createToken('api_token')->plainTextToken],
            'Your password has been changed. Any other device signed in to this account has been signed out.'
        );
    }
}
