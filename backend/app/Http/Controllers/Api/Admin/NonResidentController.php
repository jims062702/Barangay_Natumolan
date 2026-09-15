<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\BaseController;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;

/**
 * The non-residents on the register, whether or not they have an account.
 *
 * They are people the barangay deals with — living elsewhere, with
 * business here — and the account screens could not see them at all,
 * because none of them has an account. Listing user rows would have shown
 * an empty page and been technically correct.
 *
 * So this reads the REGISTER and reports the account beside each name.
 * Most have none; that is the fact worth being able to see.
 */
class NonResidentController extends BaseController
{
    public function index(Request $request)
    {
        $query = Resident::where('record_type', '!=', 'Resident')
            ->whereNull('merged_into_id')
            ->with(['account:id,resident_id,email,is_active,activated_at']);

        if ($request->filled('search')) {
            $query->nameSearch($request->search);
        }

        $page = $query->orderBy('last_name')->orderBy('first_name')->paginate(20);

        $page->getCollection()->transform(fn (Resident $r) => [
            'id' => $r->id,
            'resident_number' => $r->resident_number,
            'name' => $r->full_name,
            'record_type' => $r->record_type,
            'contact_number' => $r->contact_number,
            'address' => $r->address,
            /* Null where there is no portal account, which is the usual case
               and the reason this list exists at all. */
            'account' => $r->account ? [
                'id' => $r->account->id,
                'email' => $r->account->email,
                'is_active' => (bool) $r->account->is_active,
                'activated_at' => $r->account->activated_at,
            ] : null,
        ]);

        $payload = $page->toArray();
        $payload['counts'] = [
            'total' => Resident::where('record_type', '!=', 'Resident')->whereNull('merged_into_id')->count(),
            'with_account' => Resident::where('record_type', '!=', 'Resident')
                ->whereNull('merged_into_id')
                ->whereHas('account')
                ->count(),
        ];

        return $this->success($payload, 'Non-residents retrieved');
    }
}
