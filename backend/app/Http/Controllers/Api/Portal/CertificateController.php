<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Service\Guide;
use App\Services\Resident\DeathConfirmationService;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;

/** The resident's certificates, and what each kind needs and costs. */
class CertificateController extends PortalController
{
    public function index()
    {
        return $this->success(
            Certificate::where('resident_id', $this->residentId())
                ->latest()
                ->orderByDesc('id')
                ->paginate(15),
            'Your certificates retrieved'
        );
    }

    /**
     * Search residents to find the deceased resident for Certification of Death.
     */
    public function searchDeceased(Request $request, DeathConfirmationService $deathService)
    {
        $term = trim((string) $request->input('q', ''));
        $current = $this->resident();

        $query = Resident::query()
            ->where('id', '!=', $this->residentId())
            ->where('record_type', '!=', Resident::NON_RESIDENT);

        if ($term !== '') {
            $query->nameSearch($term);
        } else {
            // Suggest family members when search is blank
            $familyIds = collect();
            if ($current) {
                $familyIds = $current->parents()->pluck('residents.id')
                    ->merge($current->children()->pluck('residents.id'))
                    ->merge($current->spouse_id ? [$current->spouse_id] : [])
                    ->merge($current->siblings()->pluck('id'))
                    ->unique();
            }
            if ($familyIds->isNotEmpty()) {
                $query->whereIn('id', $familyIds);
            }
        }

        $results = $query->limit(20)->get()->map(function (Resident $r) use ($current, $deathService) {
            $age = $r->birthdate ? $r->birthdate->age : null;
            $relationship = $current ? $deathService->getRelationship($current, $r) : null;
            $address = $r->address ?: ($r->zone_purok ? 'Zone ' . $r->zone_purok . ', Barangay Natumolan' : 'Barangay Natumolan');

            return [
                'id' => $r->id,
                'full_name' => $r->full_name,
                'resident_number' => $r->resident_number,
                'birthdate' => $r->birthdate?->toDateString(),
                'age' => $age,
                'address' => $address,
                'zone_purok' => $r->zone_purok,
                'life_status' => $r->life_status,
                'is_deceased' => $r->isDeceased(),
                'relationship' => $relationship,
            ];
        });

        return $this->success($results, 'Matching residents');
    }

    /**
     * What the resident is choosing between, with the fee and the papers.
     *
     * The request form used to be a bare dropdown of names. A resident
     * picked one, walked to the office, and found out at the counter that
     * they needed a valid ID and ₱50 — which is a wasted trip for somebody
     * who may have walked half an hour to make it.
     *
     * The fee comes from the certificate module's own schedule, because
     * that is the number the clerk will actually charge; the requirements
     * come from the service guide, which is what the Secretary maintains.
     */
    public function services()
    {
        return $this->success(self::onlineServices(), 'Certificate services retrieved');
    }

    /**
     * What may be asked for online, with what each needs and costs — the
     * portal's form and the public Online Certificate Request read the same
     * list.
     */
    public static function onlineServices(): array
    {
        $guides = Guide::where('is_active', true)
            ->where('office', 'Main Office')
            ->get()
            ->keyBy('service_name');

        $services = [];

        foreach (CertificateCatalogue::TYPES as $type => $spec) {
            /*
             * The two lists are maintained separately and do not always
             * agree word for word: the fee schedule says "First-Time
             * Jobseeker" and the guide says "First-Time Jobseeker
             * Certification". An exact match alone dropped that one's
             * requirements silently, which is the worst way to lose them —
             * the form looked complete and told the resident nothing.
             */
            $guide = $guides->get($type)
                ?? $guides->first(fn ($g) => str_starts_with($g->service_name, $type)
                    || str_starts_with($type, $g->service_name));

            $services[] = [
                'certificate_type' => $type,
                /*
                 * Null where the ordinance prices by purpose rather than by
                 * document — a clearance is ₱20 to ₱200 depending what it is
                 * for, and printing one of those numbers as THE fee would
                 * quote most residents the wrong amount. The portal says the
                 * fee is set at the counter instead.
                 */
                'fee' => $spec['fee'] !== null ? (float) $spec['fee'] : null,
                'fee_varies' => $spec['fee'] === null,
                /*
                 * The same lists the counter picks from, so a resident can
                 * choose a listed purpose or business and see its exact fee
                 * before walking over — or choose "Others" and write their own.
                 */
                'fee_from' => $spec['fee_from'] ?? null,
                'purposes' => ($spec['fee_from'] ?? null) === 'clearance'
                    ? CertificateCatalogue::CLEARANCE_PURPOSES
                    : null,
                'business_kinds' => ($spec['fee_from'] ?? null) === 'business'
                    ? CertificateCatalogue::BUSINESS_KINDS
                    : null,
                'other_fee' => CertificateCatalogue::OTHER_CERTIFICATION_FEE,
                'documentary_stamp' => CertificateCatalogue::DOCUMENTARY_STAMP,
                'asks_purpose' => CertificateCatalogue::asksPurpose($type),
                'description' => $guide?->description,
                // Split into lines so the form can list them rather than
                // printing one long comma-separated string.
                'requirements' => $guide && trim((string) $guide->requirements) !== ''
                    ? array_values(array_filter(array_map(
                        'trim',
                        preg_split('/[,;\n]+/', $guide->requirements)
                    )))
                    : [],
                'schedule' => $guide?->schedule,
            ];
        }

        return $services;
    }
}
