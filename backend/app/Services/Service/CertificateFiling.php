<?php

namespace App\Services\Service;

use App\Models\Account\Notification;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateCatalogue;

/**
 * A certificate filed at the counter — or by a counter device that had no line.
 *
 * Everything between "the form is valid" and "here is the certificate": who
 * it may be issued to, the request it hangs on, what it costs, which number
 * it carries, and how far a device that worked offline already got with it.
 */
final class CertificateFiling
{
    public function __construct(
        private readonly CertificateWorkflow $workflow,
        private readonly CertificatePhoto $photo,
    ) {
    }

    /**
     * @param array $validated the answers from StoreCertificateRequest
     * @return array{0: Certificate, 1: string} the certificate, and what to tell the clerk
     *
     * @throws CertificateFilingRefused
     */
    public function file(array $validated): array
    {
        /*
         * A barangay certificate says something about a CONSTITUENT — that
         * they live here, that they are indigent here, that they are of good
         * moral character here. A non-resident is on the register only so a
         * family could be recorded whole: somebody's mother in Riyadh, a
         * father in Cebu. The barangay has no standing to certify anything
         * about them, and a certificate issued to one is a false document
         * with a real reference number on it.
         *
         * Refused here rather than only hidden in the picker, because the
         * picker is one of several ways a resident id reaches this endpoint.
         */
        $applicant = Resident::findOrFail($validated['resident_id']);

        /* Nothing is kept that the paper would not print. */
        if (! CertificateCatalogue::asksPurpose($validated['certificate_type'])) {
            $validated['purpose'] = null;
        }

        if ($applicant->isNonResident()) {
            throw new CertificateFilingRefused(
                $applicant->full_name . ' is recorded as living OUTSIDE Barangay Natumolan, so no '
                    . 'barangay certificate can be issued to them. They are on the register as a '
                    . 'relative of a resident, not as a constituent. If they have moved in, the '
                    . 'Population Office must convert their record first.',
                422
            );
        }

        // Walk-in: no prior request → create one automatically so the
        // certificate is always tied to a tracked service request.
        if (empty($validated['service_request_id'])) {
            $serviceRequest = ServiceRequest::create([
                'request_number' => ServiceRequest::nextNumber(),
                'resident_id' => $validated['resident_id'],
                'service_type' => $validated['certificate_type'],
                'office' => 'Main Office',
                'request_type' => 'Walk-in',
                'status' => 'In Progress',
                'purpose' => $validated['purpose'],
                'assigned_to' => auth()->id(),
            ]);
            $validated['service_request_id'] = $serviceRequest->id;
        } else {
            /*
             * One request, one certificate.
             *
             * A request filed from the portal already has its certificate
             * raised against it. Attaching a second leaves two documents on
             * one request, and everything that reads the pair back — the
             * resident's own list included — takes whichever the hasOne
             * happens to return. The resident then watches a status that
             * belongs to a document nobody is working on.
             */
            $already = Certificate::where('service_request_id', $validated['service_request_id'])
                ->whereNotIn('status', ['Cancelled'])
                ->first();

            if ($already) {
                throw new CertificateFilingRefused(
                    $already->certificate_number . ' has already been raised for this request ('
                        . $already->status . '). Open that one instead of starting another.',
                    409,
                    ['certificate_id' => $already->id]
                );
            }

            // Filing the certificate means the request is now being
            // processed — move Pending (online) requests to In Progress.
            ServiceRequest::where('id', $validated['service_request_id'])
                ->where('status', 'Pending')
                ->update(['status' => 'In Progress', 'assigned_to' => auth()->id()]);
        }

        /*
         * Fee follows the ordinance; exempt is free; an explicit amount wins.
         *
         * The type alone is not always enough to price it — a clearance is
         * priced by its purpose and a business clearance by the kind of
         * business — so the deciding answer is read out of the document's
         * own fields, which is where the clerk just typed it.
         */
        $isExempt = $validated['is_exempt'] ?? false;
        $choice = CertificateCatalogue::priceDecidingAnswer($validated['certificate_type'], $validated);

        $validated['fee_amount'] = $isExempt
            ? 0
            : ($validated['fee_amount']
                ?? CertificateCatalogue::feeFor($validated['certificate_type'], $choice)
                ?? 0);

        /* The barangay's documentary stamp, on every certificate, exempt or not.
           Set here, never taken from the request: it is not the clerk's to vary. */
        $validated['documentary_stamp'] = CertificateCatalogue::DOCUMENTARY_STAMP;

        /*
         * A number the DEVICE already put on paper is honoured.
         *
         * A clerk working with no line prints the certificate there and
         * then, and the number is on it before this request is ever made.
         * Minting a different one here would leave the office holding a
         * document whose number the register does not know.
         *
         * It is accepted only as a well-formed number of the caller's OWN
         * office series — the prefix and six digits — and only if it is
         * still free. Anything else is not a number this series issued, so
         * the server mints the next one instead. A clash is refused rather
         * than silently overwritten.
         */
        $office = auth()->user()?->office;
        $supplied = trim((string) ($validated['certificate_number'] ?? ''));

        if ($supplied !== '' && Certificate::isSeriesNumber($supplied, $office)) {
            if (Certificate::where('certificate_number', $supplied)->exists()) {
                throw new CertificateFilingRefused(
                    'Certificate number ' . $supplied . ' is already in use. This happens '
                    . 'when two devices share one number series — tell the Admin.',
                    409,
                );
            }

            $validated['certificate_number'] = $supplied;
        } else {
            $validated['certificate_number'] = Certificate::nextCertificateNumber($office);
        }
        /*
         * The verification reference, too, when the device already printed it.
         *
         * It is on the paper under "Verification Ref." — the thing a bank or
         * a school types in to check the certificate is genuine. A reference
         * minted fresh here would not match the paper, and the one document
         * the barangay issued during the outage would fail its own check.
         *
         * Held to the same shape the server makes and refused if taken.
         */
        $suppliedRef = strtoupper(trim((string) ($validated['reference_number'] ?? '')));

        if ($suppliedRef !== '' && $supplied !== '' && preg_match('/^REF-[0-9A-F]{8,20}$/', $suppliedRef)) {
            if (Certificate::where('reference_number', $suppliedRef)->exists()) {
                throw new CertificateFilingRefused('Verification reference ' . $suppliedRef . ' is already in use.', 409);
            }

            $validated['reference_number'] = $suppliedRef;
        } else {
            $validated['reference_number'] = Certificate::nextReferenceNumber();
        }

        /*
         * A certificate filed HERE is filed by a clerk who has the applicant
         * in front of them, so it starts on their desk rather than in the
         * pending queue. Only the resident's own online request produces a
         * Pending certificate (see App\Services\Portal\OnlineCertificate).
         */
        $validated['status'] = 'Processing';
        $validated['processed_by'] = auth()->id();
        $validated['processed_at'] = now();

        /* Instructions about the record, not columns of it. */
        $certificate = Certificate::create(
            collect($validated)->except(['offline_status', 'printed_at', 'released_at', 'photo_data'])->all()
        );
        $certificate->load('resident:id,first_name,last_name');

        /*
         * A walk-in served with no line does not stop at "filed".
         *
         * The resident was at the counter: the clerk filed the certificate,
         * printed it and handed it over in one sitting, all before the
         * internet came back. The job that finally arrives here says how far
         * it got, and when each step happened — so the register ends up
         * showing what actually took place at the counter, not a certificate
         * frozen at "Processing" that was in fact collected hours ago.
         *
         * Only for a device-numbered certificate, which is the mark of work
         * done offline. An ordinary online filing cannot use this to skip the
         * workflow it is supposed to go through.
         */
        /*
         * The photograph first, while the certificate is still unprinted.
         *
         * A photo can only be attached before printing — the paper and the
         * record have to agree — so it has to land before the print
         * transition below, not after it.
         */
        if ($supplied !== '' && ! empty($validated['photo_data'])
            && CertificateCatalogue::needsPhoto($certificate->certificate_type)) {
            $path = $this->photo->storeDataUrl($validated['photo_data']);

            if ($path !== null) {
                $this->photo->attach($certificate, $path);
            }
        }

        $reached = $supplied !== '' ? ($validated['offline_status'] ?? null) : null;

        if (in_array($reached, ['Ready to Claim', 'Released'], true)) {
            $this->workflow->markPrinted($certificate, $validated['printed_at'] ?? null);

            if ($reached === 'Released') {
                $this->workflow->markReleased($certificate, $validated['released_at'] ?? null);
            }

            $certificate->refresh()->load('resident:id,first_name,last_name');

            return [$certificate, 'Certificate filed from an offline device'];
        }

        Notification::notifyResident(
            $certificate->resident_id,
            'certificate_processing',
            'Certificate being prepared — ' . $certificate->certificate_number,
            'Your ' . $certificate->certificate_type . ' is being prepared. We will let you know as soon as it is ready to claim.',
            'certificate',
            $certificate->id
        );

        return [$certificate, 'Certificate filed and now being processed'];
    }
}
