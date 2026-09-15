<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Population\VerifyResidentRequest;
use App\Models\Resident\Resident;

class ResidentLookupController extends BaseController
{
    /**
     * Counter lookup used before a certificate is issued.
     *
     * Being in the registry and holding a portal account are two different
     * things — a resident can be fully registered and simply never have been
     * issued a login. The response says which, so the desk can tell at a
     * glance whether to serve the person or route them to the BPO for an
     * account, instead of assuming "no account" means "not a resident".
     */
    public function index(VerifyResidentRequest $request)
    {
        $validated = $request->validated();

        $residents = Resident::nameSearch($validated['q'])
            // A merged-away duplicate is a tombstone pointing at the record
            // that survived, not a second person. At a counter it would be
            // offered as somebody to serve.
            ->whereNull('merged_into_id')
            ->with('account:id,resident_id,email,is_active')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(15)
            ->get([
                'id', 'resident_number', 'first_name', 'middle_name', 'last_name',
                'suffix', 'birthdate', 'zone_purok', 'residency_status', 'is_active',
                'record_type', 'address', 'life_status', 'date_of_death',
            ])
            ->map(function ($resident) {
                $account = $resident->account;
                $isNonResident = $resident->isNonResident();

                return [
                    'id' => $resident->id,
                    'resident_number' => $resident->resident_number,
                    'first_name' => $resident->first_name,
                    'middle_name' => $resident->middle_name,
                    'last_name' => $resident->last_name,
                    'suffix' => $resident->suffix,
                    'birthdate' => $resident->birthdate?->toDateString(),
                    'age' => $resident->birthdate?->age,
                    /*
                     * Whether this person is a CONSTITUENT at all. Without it
                     * the counter cannot tell a resident from a relative who
                     * lives in Riyadh, and the whole purpose of this page is
                     * to answer exactly that before a certificate is filed.
                     */
                    'record_type' => $resident->record_type,
                    'is_non_resident' => $isNonResident,
                    // Where they actually are, for the ones who are not here.
                    'address' => $isNonResident ? $resident->address : null,
                    /*
                     * Purok and residency belong to people who live here.
                     * `residency_status` is NOT NULL DEFAULT 'Permanent' in
                     * the schema, so every non-resident silently carries
                     * "Permanent" — a column default that reads on screen as
                     * a statement of fact, beside a person living abroad.
                     * It is not their status; it is the absence of one.
                     */
                    'zone_purok' => $isNonResident ? null : $resident->zone_purok,
                    'residency_status' => $isNonResident ? null : $resident->residency_status,
                    // Serving somebody who has died is worse than refusing them.
                    'life_status' => $resident->life_status,
                    'date_of_death' => $resident->date_of_death?->toDateString(),
                    'is_active' => $resident->is_active,
                    'has_portal_account' => (bool) $account,
                    'portal_account_active' => $account?->is_active,
                    'portal_email' => $account?->email,
                ];
            });

        return $this->success($residents, 'Verification lookup results');
    }
}
