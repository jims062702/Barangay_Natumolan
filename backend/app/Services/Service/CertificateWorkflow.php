<?php

namespace App\Services\Service;

use App\Models\Account\Notification;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use Illuminate\Support\Carbon;

/**
 * The two moments a certificate's paper changes hands: printed, and released.
 *
 * Called from the Print and Release buttons AND from a certificate a device
 * printed with no line, so both leave exactly the same record behind — the
 * same status, the same QR, the same notice to the resident. Two copies of
 * this would drift, and the drift would only show on the certificates issued
 * during an outage.
 */
final class CertificateWorkflow
{
    /**
     * The document has been printed.
     *
     * `$at` is when it was printed. Online that is now; for a certificate
     * that arrives from a device's queue it is the moment the clerk pressed
     * Print, hours earlier — and that is the time the register must carry.
     */
    public function markPrinted(Certificate $certificate, $at = null): void
    {
        $at = $this->deviceTime($at);

        $certificate->update([
            'status' => 'Ready to Claim',
            'printed_at' => $at,
            'ready_at' => $at,
            // Issued the moment the document is real, so public verification
            // works from the second the resident is told about it.
            'qr_code' => $certificate->qr_code ?: $this->qrCode($certificate->reference_number),
        ]);

        /*
         * The request follows the counter here too.
         *
         * 'Approved' is what the service_requests enum has for "done, not yet
         * handed over"; the words the resident reads come from the
         * certificate itself, which is the only record that knows the paper
         * exists. Leaving this at 'In Progress' is what made the portal
         * disagree with the clerk.
         */
        ServiceRequest::where('id', $certificate->service_request_id)
            ->update(['status' => 'Approved']);

        Notification::notifyResident(
            $certificate->resident_id,
            'certificate_ready',
            'Ready to claim — ' . $certificate->certificate_number,
            'Your ' . $certificate->certificate_type . ' is ready to claim '
                . 'at the Barangay Main Office (Mon-Fri, 8:00 AM-5:00 PM). '
                . 'Verification reference: ' . $certificate->reference_number,
            'certificate',
            $certificate->id
        );
    }

    /** The document has been handed over. */
    public function markReleased(Certificate $certificate, $at = null): void
    {
        $at = $this->deviceTime($at);

        $certificate->update([
            'status' => 'Released',
            'released_by' => auth()->id(),
            'released_at' => $at,
            'claimed_at' => $at,
            'qr_code' => $certificate->qr_code ?: $this->qrCode($certificate->reference_number),
        ]);

        // Handing over the certificate completes the request.
        ServiceRequest::where('id', $certificate->service_request_id)
            ->update(['status' => 'Completed', 'completed_at' => $at]);

        Notification::notifyResident(
            $certificate->resident_id,
            'certificate_released',
            'Certificate received — ' . $certificate->certificate_number,
            'You have received your ' . $certificate->certificate_type . '. '
                . 'Verification reference: ' . $certificate->reference_number,
            'certificate',
            $certificate->id
        );
    }

    /**
     * A time sent from a device, made safe to store.
     *
     * The browser sends ISO-8601 with a zone ("2026-09-15T09:12:00.000Z").
     * MySQL in strict mode refuses that shape outright, and it is in UTC
     * while the register is kept in the barangay's own time — so it is
     * parsed and converted rather than passed through.
     *
     * A time in the FUTURE is not trusted: a device clock set wrong would
     * otherwise date a certificate tomorrow. It falls back to now.
     */
    private function deviceTime($at): Carbon
    {
        if (! $at) {
            return now();
        }

        try {
            $parsed = Carbon::parse($at)->setTimezone(config('app.timezone'));
        } catch (\Throwable) {
            return now();
        }

        return $parsed->isFuture() ? now() : $parsed;
    }

    private function qrCode(string $data): string
    {
        // Placeholder: integrate with QR code library
        return 'qr_' . hash('md5', $data);
    }
}
