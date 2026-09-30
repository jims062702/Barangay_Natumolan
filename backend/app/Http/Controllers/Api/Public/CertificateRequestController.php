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
use App\Services\Resident\ResidentCards;
use App\Services\Service\CertificateCatalogue;
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
            'details' => 'nullable|array',
        ] + CertificateRequests::rulesFor($missing), [
            'purpose.required' => 'Say what the certificate is for.',
            'details.*.required' => 'This certificate needs it, and your record does not have it yet.',
        ]);

        [$serviceRequest, $certificate, $filled] = DB::transaction(function () use ($resident, $missing, $data, $base, $online) {
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

            return [$serviceRequest, $online->raise($serviceRequest, $data['template_fields'] ?? []), $filled];
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
