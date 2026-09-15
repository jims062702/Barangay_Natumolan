<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateWorkflow;

/** The clerk's presses on a certificate: start, print, release, reprint. */
class CertificateWorkflowController extends BaseController
{
    public function __construct(private readonly CertificateWorkflow $workflow)
    {
    }

    /**
     * The clerk takes an online request off the queue and starts work on it.
     * This is the only thing that has to happen for a resident's request to
     * start moving — there is no approval waiting behind it.
     */
    public function accept(Certificate $certificate)
    {
        if ($certificate->status !== 'Pending') {
            return $this->error('Only pending requests can be started', 400);
        }

        $certificate->update([
            'status' => 'Processing',
            'processed_by' => auth()->id(),
            'processed_at' => now(),
        ]);

        // The linked request follows the counter.
        ServiceRequest::where('id', $certificate->service_request_id)
            ->update(['status' => 'In Progress', 'assigned_to' => auth()->id()]);

        Notification::notifyResident(
            $certificate->resident_id,
            'certificate_processing',
            'Certificate request started — ' . $certificate->certificate_number,
            'A barangay clerk has started preparing your ' . $certificate->certificate_type
                . '. We will notify you once it is ready to claim.',
            'certificate',
            $certificate->id
        );

        return $this->success($certificate, 'Request accepted — now being processed');
    }

    /**
     * The clerk prints the certificate — and that is the whole middle of the
     * workflow.
     *
     * Printing used to be three presses (mark printed, send for signature,
     * mark signed) recording a journey that happens on paper anyway, on a
     * counter one clerk runs alone. It is one press now: the document exists,
     * it goes to the Punong Barangay for signing on its way to the counter,
     * and the resident is told it is ready to claim.
     *
     * The wording is frozen from here on, because the paper now exists.
     */
    public function markPrinted(Certificate $certificate)
    {
        if ($certificate->status !== 'Processing') {
            return $this->error('Only certificates being processed can be printed', 400);
        }

        $this->workflow->markPrinted($certificate);

        return $this->success($certificate, 'Printed — the resident has been notified it is ready to claim');
    }

    /** The resident collects the document. */
    public function release(Certificate $certificate)
    {
        if ($certificate->status !== 'Ready to Claim') {
            return $this->error('Print the certificate first — only one that is ready to claim can be released', 400);
        }

        $this->workflow->markReleased($certificate);

        return $this->success($certificate, 'Certificate released to the resident');
    }

    /*
     * There is no cancel.
     *
     * The office decided a filed request is not withdrawn — it is worked, or
     * it waits. Removing the button alone would have left the endpoint
     * answering to anything that could still find it, so the rule is enforced
     * where the rule lives rather than where it is displayed.
     *
     * The Cancelled STATUS stays: four certificates already carry it, and a
     * record of what happened is not the same as permission to do it again.
     */
    public function reprint(Certificate $certificate)
    {
        if (!in_array($certificate->status, ['Ready to Claim', 'Released'], true)) {
            return $this->error('Only signed certificates can be reprinted', 400);
        }

        $certificate->increment('reprint_count');

        return $this->success([
            'certificate_number' => $certificate->certificate_number,
            'reprint_count' => $certificate->reprint_count,
            'reprinted_at' => now(),
        ], 'Certificate reprinted');
    }
}
