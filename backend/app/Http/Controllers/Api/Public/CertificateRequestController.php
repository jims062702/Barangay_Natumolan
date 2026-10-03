<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Http\Controllers\Api\Portal\CertificateController as PortalCertificateController;
use App\Models\Account\Notification;
use App\Models\Population\Zone;
use App\Models\Resident\Resident;
use App\Models\Service\ServiceRequest;
use App\Services\Portal\CertificateRequests;
use App\Services\Portal\OnlineCertificate;
use App\Services\Resident\DeathConfirmationService;
use App\Services\Resident\ResidentCards;
use App\Services\Service\CertificateCatalogue;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ONLINE CERTIFICATE REQUEST, without signing in — see
 * App\Services\Portal\CertificateRequests.
 *
 * Every step asks for the Resident ID's code again and checks it against
 * the register: the page cannot be used to learn anything about anybody
 * without their card, and a request can only ever be made in the name of
 * the resident the card names.
 */
class CertificateRequestController extends BaseController
{
    /** What may be asked for online — the portal's own list. */
    public function services()
    {
        return $this->success(PortalCertificateController::onlineServices(), 'Certificate services');
    }

    /**
     * Search residents to find the deceased resident (requires valid Resident ID).
     */
    public function deceasedSearch(Request $request, ResidentCards $cards, DeathConfirmationService $deathService)
    {
        $data = $request->validate([
            'resident_card_code' => 'required|string|max:300',
            'query' => 'nullable|string|max:100',
        ], ['resident_card_code.required' => 'Upload your Barangay Resident ID first.']);

        $resident = $this->resident($data['resident_card_code'], $cards);
        if (! $resident instanceof Resident) {
            return $resident;
        }

        $term = trim((string) ($data['query'] ?? ''));

        $query = Resident::query()
            ->where('id', '!=', $resident->id)
            ->where('record_type', '!=', Resident::NON_RESIDENT);

        if ($term !== '') {
            $query->nameSearch($term);
        } else {
            $familyIds = $resident->parents()->pluck('residents.id')
                ->merge($resident->children()->pluck('residents.id'))
                ->merge($resident->spouse_id ? [$resident->spouse_id] : [])
                ->merge($resident->siblings()->pluck('id'))
                ->unique();

            if ($familyIds->isNotEmpty()) {
                $query->whereIn('id', $familyIds);
            }
        }

        $results = $query->limit(20)->get()->map(function (Resident $r) use ($resident, $deathService) {
            $age = $r->birthdate ? $r->birthdate->age : null;
            $relationship = $deathService->getRelationship($resident, $r);
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

    /** The resident the card names — or the reason there is none. */
    private function resident(?string $code, ResidentCards $cards): Resident|\Illuminate\Http\JsonResponse
    {
        $check = $cards->verify($code);

        if (! $check['ok']) {
            return $this->error($check['message'], 422, ['resident_card_code' => [$check['message']]]);
        }

        if (! ResidentCards::eligible($check['resident'])) {
            $message = 'Certificates are issued only to current residents of Barangay Natumolan.';

            return $this->error($message, 422, ['resident_card_code' => [$message]]);
        }

        return $check['resident'];
    }

    /** A certificate type offered online, or null. */
    private function typeOf(string $serviceType, OnlineCertificate $online): ?string
    {
        $type = $online->typeFor($serviceType);

        return $type && isset(CertificateCatalogue::TYPES[$type]) ? $type : null;
    }

    /**
     * What this certificate needs about the resident, and whether their
     * record has each — WHICH, not what: nothing on the record is shown.
     */
    public function check(Request $request, ResidentCards $cards, OnlineCertificate $online)
    {
        $data = $request->validate([
            'resident_card_code' => 'required|string|max:300',
            'service_type' => 'required|string|max:120',
        ], ['resident_card_code.required' => 'Upload your Barangay Resident ID first.']);

        $resident = $this->resident($data['resident_card_code'], $cards);
        if (! $resident instanceof Resident) {
            return $resident;
        }

        $type = $this->typeOf($data['service_type'], $online);
        if (! $type) {
            return $this->error('That certificate cannot be requested online.', 422, ['service_type' => ['Choose a certificate from the list.']]);
        }

        return $this->success([
            'resident' => [
                'masked_name' => ResidentCards::mask($resident->full_name),
                'resident_number' => $resident->resident_number,
            ],
            'needs' => CertificateRequests::needs($resident, $type),
            /* For a record with no zone: the barangay's own list. */
            'zones' => Zone::where('is_active', true)->orderBy('sort_order')->orderBy('name')->pluck('name'),
        ], 'What this certificate needs');
    }

    public function store(Request $request, ResidentCards $cards, OnlineCertificate $online)
    {
        $base = $request->validate([
            'resident_card_code' => 'required|string|max:300',
            'service_type' => 'required|string|max:120',
        ], ['resident_card_code.required' => 'Upload your Barangay Resident ID first.']);

        $resident = $this->resident($base['resident_card_code'], $cards);
        if (! $resident instanceof Resident) {
            return $resident;
        }

        $type = $this->typeOf($base['service_type'], $online);
        if (! $type) {
            return $this->error('That certificate cannot be requested online.', 422, ['service_type' => ['Choose a certificate from the list.']]);
        }

        $missing = collect(CertificateRequests::needs($resident, $type))->where('on_record', false)->pluck('field')->all();

        $data = $request->validate([
            'purpose' => [$online->asksPurpose($base['service_type']) ? 'required' : 'nullable', 'string', 'max:500'],
            'template_fields' => 'nullable|array',
            'template_fields.business_name' => 'nullable|string|max:150',
            'template_fields.business_kind' => 'nullable|string|max:150',
            'template_fields.deceased_resident_id' => 'nullable|integer|exists:residents,id',
            'template_fields.deceased_name' => 'nullable|string|max:150',
            'template_fields.deceased_age' => 'nullable|string|max:20',
            'template_fields.deceased_address' => 'nullable|string|max:255',
            'template_fields.date_of_death' => 'nullable|date',
            'template_fields.time_of_death' => 'nullable|string|max:50',
            'template_fields.place_of_death' => 'nullable|string|max:255',
            'template_fields.relationship_to_deceased' => 'nullable|string|max:100',
            'template_fields.requested_by' => 'nullable|string|max:150',
            'details' => 'nullable|array',
        ] + CertificateRequests::rulesFor($missing), [
            'purpose.required' => 'Say what the certificate is for.',
            'details.*.required' => 'This certificate needs it, and your record does not have it yet.',
        ]);

        if ($type === 'Certification of Death') {
            $tf = $data['template_fields'] ?? [];
            $deceasedId = $tf['deceased_resident_id'] ?? null;
            if (! $deceasedId) {
                return $this->error('Please select the deceased resident.', 422, ['template_fields.deceased_resident_id' => ['Please search and select the deceased resident.']]);
            }
            if ((int) $deceasedId === (int) $resident->id) {
                return $this->error('You cannot request a Certification of Death for yourself.', 422, ['template_fields.deceased_resident_id' => ['You cannot request a Certification of Death for yourself.']]);
            }
            if (empty($tf['date_of_death'])) {
                return $this->error('Date of death is required.', 422, ['template_fields.date_of_death' => ['Date of death is required.']]);
            }
            if ($tf['date_of_death'] > ManilaTime::today()) {
                return $this->error('Date of death cannot be in the future.', 422, ['template_fields.date_of_death' => ['Date of death cannot be in the future.']]);
            }
            if (empty($tf['time_of_death']) || trim($tf['time_of_death']) === '') {
                return $this->error('Time of death is required.', 422, ['template_fields.time_of_death' => ['Time of death is required.']]);
            }
            if (empty($tf['place_of_death']) || trim($tf['place_of_death']) === '') {
                return $this->error('Place of death is required.', 422, ['template_fields.place_of_death' => ['Place of death is required.']]);
            }
            if (empty($tf['relationship_to_deceased']) || trim($tf['relationship_to_deceased']) === '') {
                return $this->error('Relationship to the deceased is required.', 422, ['template_fields.relationship_to_deceased' => ['Relationship to the deceased is required.']]);
            }
        }

        $templateFields = $data['template_fields'] ?? [];
        if ($type === 'Certification of Death') {
            $templateFields['requested_by'] = $resident->full_name;
            $templateFields['requester_resident_id'] = $resident->id;
            $templateFields['requester_source'] = 'resident_id_card';
        }

        [$serviceRequest, $certificate, $filled] = DB::transaction(function () use ($resident, $missing, $data, $base, $online, $templateFields) {
            $filled = CertificateRequests::fillBlanks($resident, $missing, $data['details'] ?? []);

            $serviceRequest = ServiceRequest::create([
                'request_number' => ServiceRequest::nextNumber(),
                'resident_id' => $resident->id,
                'service_type' => $base['service_type'],
                'office' => 'Main Office',
                'request_type' => 'Online',
                'status' => 'Pending',
                'purpose' => $online->asksPurpose($base['service_type']) ? ($data['purpose'] ?? null) : null,
            ]);

            return [$serviceRequest, $online->raise($serviceRequest, $templateFields), $filled];
        });

        Notification::notifyFrontDesk(
            'new_request',
            'New online request: ' . $serviceRequest->service_type,
            $resident->full_name . ' submitted a ' . $serviceRequest->service_type . ' request (' . $serviceRequest->request_number
                . ') with their Barangay Resident ID, without signing in.'
                . ($serviceRequest->purpose ? ' Purpose: ' . $serviceRequest->purpose . '.' : '')
                . ($filled ? ' They supplied: ' . implode(', ', $filled) . ' — check it when they claim it.' : ''),
            $certificate ? 'certificate' : 'service_request',
            $certificate?->id ?? $serviceRequest->id
        );

        return $this->success([
            'request_number' => $serviceRequest->request_number,
            'service_type' => $serviceRequest->service_type,
            'filled' => $filled,
        ], 'Request ' . $serviceRequest->request_number . ' received. Pay the fee and claim it at the Barangay Hall '
            . '(Monday to Friday, 8:00 AM to 5:00 PM) — bring your Barangay Resident ID.', 201);
    }
}
