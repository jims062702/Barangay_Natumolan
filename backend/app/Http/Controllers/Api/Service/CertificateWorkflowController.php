<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Resident\DeathConfirmationService;
use App\Services\Service\CertificateWorkflow;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/** The clerk's presses on a certificate: start, print, release. */
class CertificateWorkflowController extends BaseController
{
    public function __construct(
        private readonly CertificateWorkflow $workflow,
        private readonly DeathConfirmationService $deathService,
    ) {
    }

    /**
     * The clerk takes an online request off the queue and starts work on it.
     * For Certification of Death, this also verifies and confirms the death of the resident.
     */
    public function accept(Certificate $certificate)
    {
        if ($certificate->status !== 'Pending') {
            return $this->error('Only pending requests can be started', 400);
        }

        if ($certificate->certificate_type === 'Certification of Death') {
            $tf = $certificate->template_fields ?? [];
            $deceasedId = $tf['deceased_resident_id'] ?? null;
            if ($deceasedId) {
                $deceased = Resident::find($deceasedId);
                if ($deceased) {
                    $dateOfDeath = $tf['date_of_death'] ?? ManilaTime::today();
                    $this->deathService->confirmDeath(
                        $deceased,
                        $dateOfDeath,
                        'Certified deceased via online Certification of Death (' . $certificate->certificate_number . ') upon request of ' . ($certificate->resident?->full_name ?? 'resident') . '.',
                        auth()->id(),
                        $certificate
                    );
                }
            }
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

        return $this->success($certificate->load(Certificate::COUNTER_RELATIONS), 'Request accepted — now being processed');
    }

    /**
     * Explicitly verify and confirm death for a Certification of Death.
     */
    public function confirmDeath(Certificate $certificate)
    {
        if ($certificate->certificate_type !== 'Certification of Death') {
            return $this->error('Only Certification of Death can have death confirmed.', 400);
        }

        $tf = $certificate->template_fields ?? [];
        $deceasedId = $tf['deceased_resident_id'] ?? null;
        if (! $deceasedId) {
            return $this->error('No deceased resident linked to this certificate.', 422);
        }

        $deceased = Resident::findOrFail($deceasedId);
        $dateOfDeath = $tf['date_of_death'] ?? ManilaTime::today();

        $this->deathService->confirmDeath(
            $deceased,
            $dateOfDeath,
            'Certified deceased via Certification of Death (' . $certificate->certificate_number . ') upon request of ' . ($certificate->resident?->full_name ?? 'resident') . '.',
            auth()->id(),
            $certificate
        );

        if ($certificate->status === 'Pending') {
            $certificate->update([
                'status' => 'Processing',
                'processed_by' => auth()->id(),
                'processed_at' => now(),
            ]);

            ServiceRequest::where('id', $certificate->service_request_id)
                ->update(['status' => 'In Progress', 'assigned_to' => auth()->id()]);
        }

        Notification::notifyResident(
            $certificate->resident_id,
            'death_confirmed',
            'Death Certification verified — ' . $certificate->certificate_number,
            'Your Certification of Death request for ' . $deceased->full_name . ' has been verified and confirmed. The certificate is now being prepared.',
            'certificate',
            $certificate->id
        );

        return $this->success($certificate->load(Certificate::COUNTER_RELATIONS), 'Death verified and confirmed — resident status updated to Deceased');
    }

    /**
     * Reject an online certificate request with a reason (does NOT mark resident deceased).
     */
    public function reject(Request $request, Certificate $certificate)
    {
        if (! in_array($certificate->status, ['Pending', 'Processing'], true)) {
            return $this->error('Only pending or processing requests can be rejected.', 400);
        }

        $data = $request->validate([
            'reason' => 'required|string|max:255',
        ], ['reason.required' => 'Please provide a reason for rejecting the request.']);

        $certificate->update([
            'status' => 'Cancelled',
            'cancel_reason' => $data['reason'],
        ]);

        ServiceRequest::where('id', $certificate->service_request_id)
            ->update(['status' => 'Cancelled']);

        Notification::notifyResident(
            $certificate->resident_id,
            'certificate_rejected',
            'Certificate request rejected — ' . $certificate->certificate_number,
            'Your request for ' . $certificate->certificate_type . ' could not be processed. Reason: ' . $data['reason'],
            'certificate',
            $certificate->id
        );

        return $this->success($certificate->load(Certificate::COUNTER_RELATIONS), 'Request rejected. The resident has been notified.');
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

        return $this->success($certificate->load(Certificate::COUNTER_RELATIONS), 'Printed — the resident has been notified it is ready to claim');
    }

    /** The resident collects the document. */
    public function release(Certificate $certificate)
    {
        if ($certificate->status !== 'Ready to Claim') {
            return $this->error('Print the certificate first — only one that is ready to claim can be released', 400);
        }

        $this->workflow->markReleased($certificate);

        return $this->success($certificate->load(Certificate::COUNTER_RELATIONS), 'Certificate released to the resident');
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
     *
     * No "log reprint" either: the office does not keep a count of copies,
     * and a button that only adds one to a number nobody reads was removed.
     */
}
