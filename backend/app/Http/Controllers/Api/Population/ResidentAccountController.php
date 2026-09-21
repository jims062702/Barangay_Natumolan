<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Mail\PortalActivationCode;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Services\Account\PortalAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

/**
 * Resident portal accounts — BPO is the only office that creates them
 * (it verifies the person actually lives in Barangay Natumolan).
 */
class ResidentAccountController extends BaseController
{
    public function index(Request $request)
    {
        $query = User::with('resident:id,resident_number,first_name,last_name,zone_purok')
            ->where('role', 'Resident')
            // `activated_at` is what the list badges: an account exists for
            // every registered resident, but it does nothing until they enter
            // the emailed code.
            ->select(['id', 'name', 'email', 'role', 'office', 'is_active', 'activated_at', 'resident_id', 'created_at']);

        /*
         * Counted before the activation filter narrows it. Not statusCounts:
         * there is no status column here — the two states are derived from
         * whether the resident has entered their emailed code.
         *
         * The search below is applied first on purpose, so the chips describe
         * the list actually on screen.
         */
        $counted = (clone $query);

        if ($request->filled('search')) {
            $term = $request->search;
            $counted->where(fn ($q) => $q->where('name', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%"));
        }

        $counts = [
            'pending' => (clone $counted)->whereNull('activated_at')->count(),
            'done' => (clone $counted)->whereNotNull('activated_at')->count(),
        ];

        if ($request->filled('activation')) {
            $request->input('activation') === 'pending'
                ? $query->whereNull('activated_at')
                : $query->whereNotNull('activated_at');
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%"));
        }

        return $this->success(
            $query->latest()->paginate(20)->toArray() + ['counts' => $counts],
            'Resident accounts retrieved'
        );
    }

    /**
     * Issues the portal account for a resident who has none.
     *
     * This is no longer how accounts are normally made: registering a
     * resident creates one automatically (see PortalAccount::provision). This
     * endpoint exists for the records that predate that, and for the resident
     * whose registration had no email address on file — so the office has one
     * button, not a form, and the login is always the same standard account
     * with the same default password and the same email activation.
     */
    public function store(Request $request, Resident $resident)
    {
        if (!$resident->is_active) {
            return $this->error('Cannot create an account for an inactive resident record', 422);
        }

        // The resident record is the source of truth for the login address,
        // so an account is issued by first putting an email on the record.
        $validated = $request->validate([
            'email' => [
                'nullable',
                'email',
                Rule::unique('residents', 'email')->ignore($resident->id),
                'unique:users,email',
            ],
        ], [
            'email.unique' => 'This email is already in use by another resident or account.',
        ]);

        if (!empty($validated['email'])) {
            $resident->update(['email' => $validated['email']]);
            $resident->refresh();
        }

        $account = PortalAccount::provision($resident, auth()->id());

        if (!$account['created']) {
            return $this->error($account['reason'], 422);
        }

        return $this->success([
            'user' => $account['user'],
            // Shown once so the office can tell the resident at the counter.
            'password' => $account['password'],
        ], 'Portal account created. The resident was emailed their sign-in details.', 201);
    }

    /**
     * Sends a fresh activation code to a resident who has not yet completed
     * their first sign-in — the counter answer to "I never got the email".
     */
    public function resendActivation(User $user)
    {
        if ($user->role !== 'Resident') {
            return $this->error('Only resident portal accounts can be managed here', 422);
        }

        if ($user->isActivated()) {
            return $this->error('This account is already activated.', 422);
        }

        $code = $user->issueActivationOtp();

        try {
            Mail::to($user->email)->send(new PortalActivationCode($user, $code));
        } catch (\Throwable $e) {
            Log::warning('Activation code resend failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return $this->error('The code could not be emailed right now. Please try again shortly.', 500);
        }

        return $this->success(null, 'A new activation code was emailed to ' . $user->email);
    }

    /*
     * There is no changePassword, resetPassword or toggle here any more.
     *
     * An office that can set a resident's portal password is an office that
     * can sign in as them, and the one on the resident page even offered a
     * DEFAULT built from their last name and birthday — a password anybody
     * holding the register could compute for every resident at once.
     *
     * A resident who cannot reach their email gets resendActivation above:
     * it proves the mailbox rather than going around it. Disabling an account
     * went with it; it was the same reach into somebody else's login.
     */
}
