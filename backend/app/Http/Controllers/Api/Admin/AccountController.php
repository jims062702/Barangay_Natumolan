<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Admin\StoreStaffAccountRequest;
use App\Http\Requests\Admin\UpdateAccountRequest;
use App\Models\Account\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Staff account management — System Administration module.
 * Route group is gated to role Admin (office:AdminRole).
 * Resident portal accounts are created by the BPO, not here.
 */
class AccountController extends BaseController
{
    /**
     * Work that cannot be un-attributed.
     *
     * Five columns in this database point at a user with ON DELETE RESTRICT —
     * the person who filed an ordinance, ran a health visit, gave an
     * immunisation, uploaded a VAWC document or recorded a follow-up. The
     * database will refuse to forget them, and it is right to: a health record
     * with nobody attached to it is not a record.
     *
     * Checked here rather than caught as a SQL error, so the answer is a
     * sentence a clerk can act on instead of a stack trace.
     */
    private const WORK_THAT_HOLDS = [
        ['administrative_records', 'created_by', 'administrative record'],
        ['health_visits', 'service_provider_id', 'health visit'],
        ['immunization_records', 'administered_by', 'immunisation'],
        ['vawc_documents', 'uploaded_by', 'VAWC document'],
        ['vawc_followups', 'recorded_by', 'VAWC follow-up'],
    ];

    public function index(Request $request)
    {
        $query = User::with('resident:id,resident_number,first_name,last_name');

        /*
         * Staff and residents are two different lists.
         *
         * Shown together, forty-odd resident accounts buried the nine staff
         * ones this screen exists to manage — and the two are looked at for
         * entirely different reasons. Staff is the default because that is
         * what somebody opening "Staff Accounts" came for.
         */
        /*
         * Never your own account.
         *
         * The server refuses a self-deactivate and a self-delete, so nothing
         * could actually go wrong — but a Deactivate button sitting on your
         * own row is a trap you only have to fall into once, and the person
         * who falls in is the one who could have undone it.
         *
         * Excluded here rather than hidden in the table, so the row cannot
         * come back the next time somebody edits that column.
         */
        $query->where('id', '!=', auth()->id());

        $kind = $request->input('kind', 'staff');

        if ($kind === 'resident') {
            $query->where('role', 'Resident');
        } elseif ($kind !== 'all') {
            $query->where('role', '!=', 'Resident');
        }

        if ($request->filled('office')) {
            $query->where('office', $request->office);
        }
        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%"));
        }

        $page = $query->orderBy('name')->paginate(20);

        /* Both totals travel, so the tab a clerk is NOT on can still say how
           many are waiting behind it. */
        $payload = $page->toArray();
        /* Counted the same way the list is filtered, or the tab would promise
           a row that is not there. */
        $payload['counts'] = [
            'staff' => User::where('role', '!=', 'Resident')->where('id', '!=', auth()->id())->count(),
            'resident' => User::where('role', 'Resident')->where('id', '!=', auth()->id())->count(),
        ];

        return $this->success($payload, 'Users retrieved');
    }

    public function store(StoreStaffAccountRequest $request)
    {
        $validated = $request->validated();

        $user = User::create($validated + [
            'password' => Hash::make($validated['password']),
            'is_active' => true,
            // An administrator has already verified this person, so there is
            // nothing to prove by email — only resident portal accounts,
            // which the system creates on their behalf, need activating.
            'activated_at' => now(),
            'created_by' => auth()->id(),
        ]);

        return $this->success($user, 'Staff account created', 201);
    }

    public function update(UpdateAccountRequest $request, User $user)
    {
        $validated = $request->validated();

        if (array_key_exists('password', $validated)) {
            if ($validated['password']) {
                $validated['password'] = Hash::make($validated['password']);
            } else {
                unset($validated['password']);
            }
        }

        if ($user->id === auth()->id() && array_key_exists('is_active', $validated) && !$validated['is_active']) {
            return $this->error('You cannot deactivate your own account', 422);
        }

        $user->update($validated);

        /* Deactivating must actually end the sessions. Left running, a
           disabled account keeps working until its token happens to age out. */
        if (array_key_exists('is_active', $validated) && ! $validated['is_active']) {
            $user->tokens()->delete();
        }

        return $this->success($user, 'Account updated');
    }

    public function destroy(User $user)
    {
        if ($user->id === auth()->id()) {
            return $this->error('You cannot delete your own account.', 422);
        }

        /*
         * Resident accounts are reachable from here as well as from the
         * Population Office. Deleting one removes the PORTAL ACCOUNT, never
         * the resident: the register entry, the household, the certificates
         * all stay, and the Population Office can issue a new account for the
         * same person afterwards.
         */

        $held = [];

        foreach (self::WORK_THAT_HOLDS as [$table, $column, $noun]) {
            $count = DB::table($table)->where($column, $user->id)->count();

            if ($count > 0) {
                $held[] = $count . ' ' . $noun . ($count === 1 ? '' : 's');
            }
        }

        if ($held) {
            return $this->error(
                'This account cannot be deleted: it is attached to ' . implode(', ', $held)
                    . '. Deactivate it instead — that ends their access and keeps the records readable.',
                422,
            );
        }

        $user->tokens()->delete();
        $user->delete();

        return $this->success(null, 'Account deleted');
    }
}
