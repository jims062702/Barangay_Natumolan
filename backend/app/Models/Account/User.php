<?php

namespace App\Models\Account;

use Database\Factories\Account\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Resident\Resident;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $with = ['resident'];

    protected $fillable = [
        'name',
        'email',
        /* An address asked for but not yet proved. Never the login until a
           code sent TO IT comes back — see redeemActivationOtp(). */
        'pending_email',
        'password',
        'role',
        'office',
        'is_active',
        'activated_at',
        'resident_id',
        'created_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        // The code is a credential in its own right — never serialise it,
        // nor the bookkeeping that tells an attacker how it is being used.
        'otp_code',
        'otp_expires_at',
        'otp_sent_at',
        'otp_attempts',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'activated_at' => 'datetime',
            'otp_expires_at' => 'datetime',
            'otp_sent_at' => 'datetime',
        ];
    }

    /** Linked resident record (portal accounts only). */
    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    /*
     * These MUST match the `role` and `office` enums on the users table. When
     * they drifted apart, the form offered "Child Development Worker" / "CDC"
     * — which the database no longer accepts — while offering no SK role at
     * all, so an SK account simply could not be created. Kept in one place so
     * creating and editing an account can never disagree again.
     */
    public const ROLES = [
        'Punong Barangay',
        'Secretary',
        'Clerk',
        'VAWC Officer',
        'Lupon Secretary',
        'Population Worker',
        'Health Personnel',
        'SK Chairperson',
        'SK Kagawad',
        'SK Secretary',
        'Admin',
    ];

    public const OFFICES = [
        'Main Office',
        'VAWC',
        'Lupon',
        'Population',
        'Health Station',
        'SK',
        'Admin',
    ];

    /**
     * Writes the new password and closes every session that used the old one.
     *
     * Revoking the tokens is the part that is easy to leave out and matters
     * most: somebody resetting a password because a phone was lost has not
     * fixed anything if the session on that phone keeps working. Every path
     * that sets a password — the emailed reset, the in-account change, the
     * Population Office counter — comes through here for that reason.
     *
     * @param int|null $by the user who set it, or null when the owner did by code
     */
    public function setPassword(string $password, ?int $by): void
    {
        $this->forceFill([
            'password' => Hash::make($password),
            'password_set_at' => now(),
            'password_set_by' => $by,
        ])->save();

        $currentToken = $this->currentAccessToken();
        if ($currentToken) {
            $this->tokens()->where('id', '!=', $currentToken->id)->delete();
        } else {
            $this->tokens()->delete();
        }
    }

    public function isResident(): bool
    {
        return $this->role === 'Resident';
    }

    /*
    |--------------------------------------------------------------------------
    | Email activation (resident portal)
    |--------------------------------------------------------------------------
    | Portal accounts are created automatically when the BPO registers a
    | resident, so the account exists before anyone has proved they own the
    | mailbox. The first login sends a code there; entering it is what turns
    | the account on.
    */

    /** How long a code stays usable, and how many guesses it allows. */
    public const OTP_TTL_MINUTES = 10;
    public const OTP_MAX_ATTEMPTS = 5;

    public function isActivated(): bool
    {
        return $this->activated_at !== null;
    }

    /**
     * Issues a fresh code, replacing any outstanding one. Returns the plain
     * code so the caller can mail it — it is never readable again afterwards
     * from anywhere but this row.
     */
    public function issueActivationOtp(): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $this->forceFill([
            'otp_code' => Hash::make($code),
            'otp_expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
            'otp_sent_at' => now(),
            'otp_attempts' => 0,
        ])->save();

        return $code;
    }

    /** Whether a code was issued recently enough to still be entered. */
    public function hasLiveOtp(): bool
    {
        return $this->otp_code !== null
            && $this->otp_expires_at !== null
            && $this->otp_expires_at->isFuture();
    }

    /**
     * Checks a submitted code and, on a match, activates the account and
     * clears the code so it cannot be replayed.
     *
     * A PENDING EMAIL BECOMES THE LOGIN HERE, and nowhere else. The code was
     * sent to that address, so answering it is the proof that the person
     * asking for the change can actually read mail there — which is the
     * whole reason the address waited instead of being written straight in.
     *
     * That also settles the awkward case: somebody who changes their address
     * BEFORE ever activating. One code does both jobs, because both jobs are
     * the same job — proving this mailbox belongs to this person.
     */
    public function redeemActivationOtp(string $code): bool
    {
        if (!$this->hasLiveOtp() || $this->otp_attempts >= self::OTP_MAX_ATTEMPTS) {
            return false;
        }

        if (!Hash::check($code, $this->otp_code)) {
            $this->increment('otp_attempts');

            return false;
        }

        $this->forceFill([
            'email' => $this->pending_email ?: $this->email,
            'pending_email' => null,
            'activated_at' => now(),
            'email_verified_at' => now(),
            'otp_code' => null,
            'otp_expires_at' => null,
            'otp_attempts' => 0,
        ])->save();

        return true;
    }

    /**
     * Where the next code should be sent.
     *
     * The address being PROVED, which is the pending one whenever there is
     * one. Sending to the current address instead would let somebody change
     * the login to an address they cannot read, and confirm it from the one
     * they can — which proves nothing about the new mailbox.
     */
    public function otpDestination(): string
    {
        return $this->pending_email ?: $this->email;
    }

    /**
     * The password every portal account starts with: the resident's LAST NAME,
     * its first letter a capital and the rest small, followed by the YEAR they
     * were born — Gasang, born in 2002, starts with "Gasang2002" (2026-09-30).
     *
     * Spaces and punctuation are dropped, so "Dela Cruz" is "Delacruz1990",
     * and an Ñ is typed as N — "Peñaranda" is "Penaranda1990" — so a phone
     * keyboard without one can still sign in.
     *
     * Returns null when the record has no birthdate, which is the one case
     * where no default can be derived.
     */
    public static function defaultPortalPassword(Resident $resident): ?string
    {
        if (!$resident->birthdate) {
            return null;
        }

        $lastName = strtr((string) $resident->last_name, ['Ñ' => 'N', 'ñ' => 'n']);
        $lastName = preg_replace('/[^A-Za-z0-9]/', '', $lastName);

        /*
         * The year, and nothing else of the birthday.
         *
         * This was the month and year, and before that MMDDYY. But the census
         * now asks Q5 for the year alone, and the months and days the register
         * was loaded with are the part the office does not trust — a password
         * built from them was built from a number the resident may never have
         * given. The year is what they know and what the record holds.
         */
        return ucfirst(strtolower($lastName)) . $resident->birthdate->format('Y');
    }

    public function isStaff(): bool
    {
        return $this->role !== 'Resident';
    }
}
