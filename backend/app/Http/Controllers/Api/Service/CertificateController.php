<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Service\StoreCertificateRequest;
use App\Models\Service\Certificate;
use App\Services\Service\CertificateFiling;
use App\Services\Service\CertificateFilingRefused;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;

/**
 * Certificates & clearances.
 *
 * There is no approval step and no signature step. The resident asks, the
 * CLERK does the work, and the Punong Barangay signs the paper — which is a
 * thing that happens at a desk, not a button anyone has to click. The
 * register follows the document in three presses:
 *
 *   Pending → Processing → Ready to Claim → Released
 *
 * The resident is told twice, which is what they actually wait for: when the
 * certificate is ready to claim, and when they have received it.
 */
class CertificateController extends BaseController
{
    public function index(Request $request)
    {
        /*
         * The request behind it, for one column only: whether it was asked
         * for at the counter or online. A clerk deciding what to do with a
         * finished certificate needs to know which — somebody who walked in
         * is expecting to be called; somebody who asked online may never
         * open their portal to find out it is ready.
         *
         * Two columns of it, not the whole request: this is a list of
         * twenty, and the rest of the request is a modal away.
         */
        $query = Certificate::with([
            'resident', 'processor', 'signer', 'releaser',
            'serviceRequest:id,request_type',
        ]);

        if ($request->has('resident_id')) {
            $query->where('resident_id', $request->resident_id);
        }

        if ($request->has('certificate_type')) {
            $query->where('certificate_type', $request->certificate_type);
        }

        // Counted before the status filter narrows it — see statusCounts.
        $counts = $this->statusCounts($query);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        /*
         * Newest first, and the id settles a tie. Certificates filed with no
         * line reach the server together when it returns, often inside the
         * same second — and with created_at alone MySQL handed those back in
         * whatever order it liked, so 000003 could sit above 000002.
         */
        $certificates = $query->orderBy('created_at', 'desc')->orderBy('id', 'desc')->paginate(20);

        return $this->success(
            $certificates->toArray() + ['counts' => $counts],
            'Certificates retrieved'
        );
    }

    public function store(StoreCertificateRequest $request, CertificateFiling $filing)
    {
        try {
            [$certificate, $message] = $filing->file($request->validated());
        } catch (CertificateFilingRefused $refused) {
            return $this->error($refused->getMessage(), $refused->status, $refused->errors);
        }

        return $this->success($certificate, $message, 201);
    }

    public function show(Certificate $certificate)
    {
        $certificate->load(['resident', 'serviceRequest', 'processor', 'signer', 'releaser']);

        return $this->success($certificate, 'Certificate retrieved');
    }

    /**
     * Corrects the certificate type or purpose — a misspelling caught before
     * the document is printed.
     *
     * Only possible before printing: once a certificate has been printed the
     * physical document exists, and altering the record behind it would leave
     * the paper and the register disagreeing.
     */
    public function update(Request $request, Certificate $certificate)
    {
        if ($certificate->status === Certificate::CANCELLED) {
            return $this->error('A cancelled application cannot be edited. File a new one.', 409);
        }

        if (!$certificate->isBeforePrinting()) {
            return $this->error(
                'This certificate has already been printed, so its details can no longer be edited. File a new application with the corrected wording.',
                409
            );
        }

        $validated = $request->validate([
            'certificate_type' => 'sometimes|in:' . implode(',', CertificateCatalogue::typeNames()),
            'purpose' => 'sometimes|nullable|string|max:255',
            'template_fields' => 'nullable|array',
        ]);

        /*
         * A type whose form has no purpose drops the one it had — changing an
         * online Barangay Clearance to a Construction Clearance should not
         * carry the clearance's purpose along unseen. A type that does have
         * one must not be left without it.
         */
        $newType = $validated['certificate_type'] ?? $certificate->certificate_type;

        if (! CertificateCatalogue::asksPurpose($newType)) {
            $validated['purpose'] = null;
        } elseif (trim((string) ($validated['purpose'] ?? $certificate->purpose)) === '') {
            return $this->error('Please enter the purpose — it is printed on this certificate.', 422);
        }

        /*
         * The purpose moves the price too, not only the type — correcting
         * "Loan Purposes" to "Mayor's Permit" is a ₱160 correction. Repricing
         * only on a type change left the old amount on the record.
         */
        $reprice = (isset($validated['certificate_type'])
                && $validated['certificate_type'] !== $certificate->certificate_type)
            || (isset($validated['purpose']) && $validated['purpose'] !== $certificate->purpose);

        if ($reprice && ! $certificate->is_exempt) {
            $type = $validated['certificate_type'] ?? $certificate->certificate_type;

            $validated['fee_amount'] = CertificateCatalogue::feeFor(
                $type,
                CertificateCatalogue::priceDecidingAnswer($type, [
                    'purpose' => $validated['purpose'] ?? $certificate->purpose,
                    'template_fields' => $validated['template_fields']
                        ?? $certificate->template_fields
                        ?? [],
                ])
            ) ?? 0;
        }

        $certificate->update($validated);
        $certificate->load('resident:id,first_name,last_name');

        return $this->success($certificate, 'Certificate updated');
    }
}
