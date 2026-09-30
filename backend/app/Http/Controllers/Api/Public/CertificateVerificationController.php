<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Models\Service\Certificate;

class CertificateVerificationController extends BaseController
{
    /** QR / reference-number verification of an issued certificate. */
    public function show(string $referenceNumber)
    {
        $certificate = Certificate::with('resident:id,first_name,last_name')
            ->where('reference_number', $referenceNumber)
            ->first();

        if (!$certificate) {
            return $this->success([
                'valid' => false,
                'message' => 'No certificate found for this reference number.',
            ], 'Verification complete');
        }

        /*
         * A certificate is genuine from the moment it is signed — that is the
         * act that makes the paper real — so verification succeeds for one
         * waiting on the counter as well as one already handed over. Anything
         * still being prepared, or cancelled, is not a document yet.
         */
        return $this->success([
            'valid' => in_array($certificate->status, ['Ready to Claim', 'Released'], true),
            'certificate_number' => $certificate->certificate_number,
            'certificate_type' => $certificate->certificate_type,
            /* The resident — or the person typed at the counter before the
               register listed them. */
            'holder' => $certificate->holderName(),
            'status' => $certificate->status,
            'issued_at' => $certificate->released_at ?? $certificate->signed_at,
        ], 'Verification complete');
    }
}
