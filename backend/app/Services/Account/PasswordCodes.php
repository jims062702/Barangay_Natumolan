<?php

namespace App\Services\Account;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * The 6-digit codes behind a forgotten password and an in-account change.
 *
 * One row per address in password_reset_tokens. The code is stored hashed,
 * like the activation code: a reset row that carries a working code in plain
 * text is a second password store.
 */
final class PasswordCodes
{
    public const TTL_MINUTES = 15;

    /** Wrong guesses allowed before the code is thrown away. */
    private const MAX_ATTEMPTS = 5;

    /** A fresh code for the address, replacing any outstanding one. Returns the plain code to mail. */
    public function issue(string $email): string
    {
        $code = (string) random_int(100000, 999999);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token' => Hash::make($code),
                'attempts' => 0,
                'created_at' => now(),
            ],
        );

        return $code;
    }

    /**
     * The code, judged. Null when it is right.
     *
     * Shared by the verify step and the set-password steps on purpose. Written
     * twice, the two would drift, and the one that drifted would be the one
     * that actually changes a password.
     */
    public function check(string $email, string $code): ?CodeRejection
    {
        $row = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $row) {
            return new CodeRejection('That code is not valid. Ask for a new one.', 422);
        }

        /*
         * Compared, not subtracted.
         *
         * `now()->diffInMinutes($past)` returns a NEGATIVE number in current
         * Carbon, so `>= 15` was false for every code however old — and every
         * expired code went on working. The row is deleted rather than merely
         * refused, so a stale code cannot sit waiting for the clock to be wrong.
         */
        if (Carbon::parse($row->created_at)->lt(now()->subMinutes(self::TTL_MINUTES))) {
            $this->forget($email);

            return new CodeRejection('That code has expired. Ask for a new one.', 422);
        }

        if ($row->attempts >= self::MAX_ATTEMPTS) {
            $this->forget($email);

            return new CodeRejection('Too many wrong codes. Ask for a new one.', 429);
        }

        if (! Hash::check($code, $row->token)) {
            DB::table('password_reset_tokens')->where('email', $email)->increment('attempts');

            return new CodeRejection('That code is not valid.', 422);
        }

        return null;
    }

    public function forget(string $email): void
    {
        DB::table('password_reset_tokens')->where('email', $email)->delete();
    }
}
