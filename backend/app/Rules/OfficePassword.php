<?php

namespace App\Rules;

use Illuminate\Validation\Rules\Password;

/**
 * What an office account's password has to be.
 *
 * WHY OFFICES AND NOT RESIDENTS. An office device can now be signed into
 * with no server. That works by checking the typed password against a
 * one-way hash kept on the device — and a hash that sits on a laptop can be
 * guessed at, offline, as fast as the machine allows, with no server to lock
 * anybody out after five tries.
 *
 * The old rule was `min:8` and nothing else, so "12345678" and "barangay"
 * were both acceptable. Those fall to a guessing run in moments. This is the
 * one place the barangay's own choice of password decides how safe offline
 * mode is.
 *
 * Residents are not held to it. Their accounts never sign in offline, and
 * their starting password is issued by the system rather than chosen.
 *
 * Existing passwords are NOT invalidated. The rule applies when a password
 * is set or changed; an office signing in with an older, weaker password
 * still gets in, and is asked for a stronger one the next time it changes.
 */
class OfficePassword
{
    public static function rule(): Password
    {
        /*
         * Deliberately NOT ->uncompromised(). That checks the password
         * against a breach database over the internet, and this system has
         * to be able to change a password with no line at all.
         */
        return Password::min(10)
            ->mixedCase()
            ->numbers();
    }
}
