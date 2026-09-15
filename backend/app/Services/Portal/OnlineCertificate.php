<?php

namespace App\Services\Portal;

use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateCatalogue;

/**
 * The certificate behind a resident's online request.
 *
 * A request for a certificate raises the certificate itself, Pending, so the
 * resident's ask lands directly on the clerk's worklist in Certificates &
 * Clearances. Nothing waits on an approval behind it: the clerk simply
 * accepts it and starts.
 */
final class OnlineCertificate
{
    /**
     * The template fields a RESIDENT may fill in, per certificate type.
     *
     * Everything else on a certificate is the office's to record: the OR
     * number is proof of a payment the resident has not yet made, and the
     * officer of the day is whichever kagawad is on duty when they arrive.
     * Accepting those from an online form would let a resident print a
     * receipt number on their own clearance.
     */
    private const RESIDENT_FIELDS = [
        'Business Barangay Clearance' => ['business_name', 'business_kind'],
    ];

    /** The certificate an online request raises, if it raises one. */
    public function typeFor(string $serviceType): ?string
    {
        /*
         * The portal offers every type in the catalogue, by its own name. The
         * older map only knew nine service names, so a resident who asked for
         * a Certification of Death — offered to them on the same form — got a
         * request and no certificate, and it never reached the clerk's list.
         */
        return CertificateCatalogue::SERVICE_TYPES[$serviceType]
            ?? (isset(CertificateCatalogue::TYPES[$serviceType]) ? $serviceType : null);
    }

    /** Whether the request asks for a purpose. Anything that is not a certificate still does. */
    public function asksPurpose(string $serviceType): bool
    {
        $type = $this->typeFor($serviceType);

        return $type === null || CertificateCatalogue::asksPurpose($type);
    }

    public function raise(ServiceRequest $serviceRequest, array $fields = []): ?Certificate
    {
        $type = $this->typeFor((string) $serviceRequest->service_type);

        if (!$type) {
            return null;
        }

        $allowed = array_filter(
            array_intersect_key($fields, array_flip(self::RESIDENT_FIELDS[$type] ?? [])),
            fn ($value) => is_string($value) && trim($value) !== ''
        );
        $allowed = array_map('trim', $allowed);

        return Certificate::raiseFor($serviceRequest, $type, [
            'purpose' => CertificateCatalogue::asksPurpose($type) ? ($serviceRequest->purpose ?: $type) : null,
            'template_fields' => $allowed ?: null,
            /*
             * Priced from whichever answer the ordinance prices this type by —
             * the purpose for a clearance, the kind of business for a business
             * clearance. A purpose or business the resident typed under
             * "Others" is not on the list and lands on the catch-all; the
             * clerk reviews it and, if a listed one fits, picking it reprices.
             */
            'fee_amount' => CertificateCatalogue::feeFor(
                $type,
                (CertificateCatalogue::TYPES[$type]['fee_field'] ?? 'purpose') === 'business_kind'
                    ? ($allowed['business_kind'] ?? null)
                    : $serviceRequest->purpose
            ) ?? 0,
            'status' => 'Pending',
        ]);
    }
}
