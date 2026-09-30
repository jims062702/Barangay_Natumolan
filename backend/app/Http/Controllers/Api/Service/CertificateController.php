<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Service\StoreCertificateBatchRequest;
use App\Http\Requests\Service\StoreCertificateRequest;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateFiling;
use App\Services\Service\CertificateFilingRefused;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'serviceRequest:id,request_type,transaction_code',
        ]);

        if ($request->has('resident_id')) {
            $query->where('resident_id', $request->resident_id);
        }

        if ($request->has('certificate_type')) {
            $query->where('certificate_type', $request->certificate_type);
        }

        /* The other certificates of one visit — see ServiceRequest::TRANSACTION_CODE. */
        if ($request->filled('transaction_code')) {
            $query->whereHas('serviceRequest', fn ($q) => $q->where('transaction_code', $request->transaction_code));
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

        /*
         * How many certificates each row's visit asked for, so the list can
         * say "1 of 3" — counted for the codes on this page only, in one
         * query, whatever page the others landed on.
         */
        $codes = collect($certificates->items())->pluck('serviceRequest.transaction_code')->filter()->unique();
        $sizes = $codes->isEmpty() ? collect() : ServiceRequest::whereIn('transaction_code', $codes)
            ->groupBy('transaction_code')
            ->selectRaw('transaction_code, COUNT(*) AS n')
            ->pluck('n', 'transaction_code');
        $certificates->getCollection()->each(fn (Certificate $c) => $c->setAttribute(
            'transaction_size',
            $c->serviceRequest?->transaction_code ? (int) ($sizes[$c->serviceRequest->transaction_code] ?? 1) : null,
        ));

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

    /**
     * Several certificates for one resident, in one visit.
     *
     * ALL OR NOTHING. Each is filed exactly as a single one is — its own
     * number, request and status — inside one database transaction, so a
     * certificate the server refuses (a non-resident, a request already
     * raised) leaves none of the others behind. Filed half-way, the clerk
     * would press again and file the first ones twice.
     */
    public function storeBatch(StoreCertificateBatchRequest $request, CertificateFiling $filing)
    {
        $validated = $request->validated();
        $items = $validated['items'];
        $code = $validated['transaction_code']
            ?? (count($items) > 1 ? ServiceRequest::newTransactionCode() : null);

        try {
            $certificates = DB::transaction(function () use ($items, $validated, $code, $filing) {
                $filed = [];

                foreach ($items as $i => $item) {
                    try {
                        [$certificate] = $filing->file([
                            ...$item,
                            'resident_id' => $validated['resident_id'],
                            'transaction_code' => $code,
                        ]);
                    } catch (CertificateFilingRefused $refused) {
                        throw new CertificateFilingRefused(
                            'Certificate ' . ($i + 1) . ' (' . $item['certificate_type'] . '): ' . $refused->getMessage()
                                . ' Nothing was filed.',
                            $refused->status,
                            $refused->errors,
                        );
                    }

                    $filed[] = $certificate;
                }

                return $filed;
            });
        } catch (CertificateFilingRefused $refused) {
            return $this->error($refused->getMessage(), $refused->status, $refused->errors);
        }

        $count = count($certificates);

        return $this->success(
            ['transaction_code' => $code, 'certificates' => $certificates],
            $count === 1 ? 'Certificate filed and now being processed' : $count . ' certificates filed and now being processed',
            201
        );
    }

    public function show(Certificate $certificate)
    {
        $certificate->load(Certificate::COUNTER_RELATIONS);

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
        /*
         * And the kind of business moves a business clearance's price — it is
         * one of the template fields, filled in on the record before it
         * prints when the resident asked online without it.
         */
        $newAnswers = [
            'purpose' => $validated['purpose'] ?? $certificate->purpose,
            'template_fields' => $validated['template_fields'] ?? $certificate->template_fields ?? [],
        ];
        $answerChanged = CertificateCatalogue::priceDecidingAnswer($newType, $newAnswers)
            !== CertificateCatalogue::priceDecidingAnswer($certificate->certificate_type, [
                'purpose' => $certificate->purpose,
                'template_fields' => $certificate->template_fields ?? [],
            ]);

        $reprice = (isset($validated['certificate_type'])
                && $validated['certificate_type'] !== $certificate->certificate_type)
            || (isset($validated['purpose']) && $validated['purpose'] !== $certificate->purpose)
            || $answerChanged;

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
        /* The whole holder, not only the name: the window shows the purok and
           the contact number too, and replaces its record with this one. */
        $certificate->load(Certificate::COUNTER_RELATIONS);

        return $this->success($certificate, 'Certificate updated');
    }
}
