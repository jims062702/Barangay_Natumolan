<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Portal\StoreRequestRequest;
use App\Models\Account\Notification;
use App\Models\Chat\Conversation;
use App\Models\Service\ServiceRequest;
use App\Services\Portal\OnlineCertificate;
use Illuminate\Support\Facades\DB;

/** The resident's own requests: made, read, taken back and resumed. */
class RequestController extends PortalController
{
    /**
     * Statuses a request can still be taken back from.
     *
     * Only the ones that mean NOBODY HAS STARTED. Once a clerk has picked
     * the request up, the resident withdrawing it would pull work out from
     * under somebody mid-task — and once the paper is printed there is a
     * numbered document on the counter that a tap on a phone must not be
     * able to un-issue.
     */
    private const CANCELLABLE_REQUEST = ['Pending'];

    /** And the document's own status, which is the one that knows. */
    private const CANCELLABLE_CERTIFICATE = ['Pending'];

    public function index()
    {
        return $this->success(
            /*
             * Table-qualified: certificate() is a latestOfMany relation, which
             * joins the table to itself, and an unqualified column list is
             * ambiguous across that join.
             */
            ServiceRequest::with(['certificate' => fn ($q) => $q->select([
                'certificates_clearances.id',
                'certificates_clearances.service_request_id',
                'certificates_clearances.certificate_number',
                'certificates_clearances.certificate_type',
                'certificates_clearances.status',
                'certificates_clearances.reference_number',
                'certificates_clearances.fee_amount',
                'certificates_clearances.documentary_stamp',
                'certificates_clearances.released_at',
            ])])
                ->where('resident_id', $this->residentId())
                ->latest()
                ->orderByDesc('id')
                ->paginate(15),
            'Your service requests retrieved'
        );
    }

    public function store(StoreRequestRequest $request, OnlineCertificate $certificates)
    {
        $validated = $request->validated();

        $serviceRequest = ServiceRequest::create([
            'request_number' => ServiceRequest::nextNumber(),
            'resident_id' => $this->residentId(),
            'service_type' => $validated['service_type'],
            'office' => $validated['office'] ?? 'Main Office',
            'request_type' => 'Online',
            'status' => 'Pending',
            'purpose' => $certificates->asksPurpose($validated['service_type']) ? ($validated['purpose'] ?? null) : null,
        ]);

        $certificate = $certificates->raise($serviceRequest, $validated['template_fields'] ?? []);

        /*
         * If it came from a live conversation, say so in the conversation.
         * Best-effort: the request is already made, and a chat that cannot
         * be written to is not a reason to fail it.
         */
        if (!empty($validated['session_token'])) {
            $conversation = Conversation::where('session_token', $validated['session_token'])
                ->where('resident_id', $this->residentId())
                ->whereIn('status', ['Waiting', 'Active'])
                ->first();

            $conversation?->addMessage(
                'system',
                'Request ' . $serviceRequest->request_number . ' — '
                    . $serviceRequest->service_type . ' — was raised from this chat.'
            );
        }

        // Ping the front desk so the clerk sees (and hears) the new request.
        $residentName = $serviceRequest->resident?->full_name ?? 'A resident';
        Notification::notifyFrontDesk(
            'new_request',
            'New online request: ' . $serviceRequest->service_type,
            $residentName . ' submitted a ' . $serviceRequest->service_type
                . ' request (' . $serviceRequest->request_number . '). Purpose: ' . $serviceRequest->purpose,
            $certificate ? 'certificate' : 'service_request',
            $certificate?->id ?? $serviceRequest->id
        );

        $serviceRequest->load('certificate');

        return $this->success($serviceRequest, 'Request submitted — you will be notified of updates', 201);
    }

    public function show(ServiceRequest $serviceRequest)
    {
        if ($serviceRequest->resident_id !== $this->residentId()) {
            return $this->forbidden('This request does not belong to your account');
        }

        $serviceRequest->load(['certificate', 'appointments', 'assignedUser:id,name']);

        return $this->success($serviceRequest, 'Request retrieved');
    }

    /**
     * The resident takes back a request they did not mean to make.
     *
     * Withdrawn, not deleted. The row keeps its request number, its filed
     * date and its certificate — which already holds a certificate number
     * drawn from the register's series. Deleting it would either strand
     * that number or, worse, invite it to be handed out twice.
     *
     * That is also why resuming is possible at all: the record never left.
     */
    public function cancel(ServiceRequest $serviceRequest)
    {
        if ($serviceRequest->resident_id !== $this->residentId()) {
            return $this->forbidden('This request does not belong to your account');
        }

        if ($serviceRequest->status === 'Cancelled') {
            return $this->success($serviceRequest->fresh('certificate'), 'This request is already cancelled');
        }

        $certificate = $serviceRequest->certificate;

        /*
         * The document decides, where there is one. A request still reading
         * "Pending" while the clerk has already printed the certificate is
         * exactly the disagreement this portal was rebuilt to stop, and
         * cancelling off the stale half of it would throw away real work.
         */
        $blocked = $certificate !== null
            ? ! in_array($certificate->status, self::CANCELLABLE_CERTIFICATE, true)
            : ! in_array($serviceRequest->status, self::CANCELLABLE_REQUEST, true);

        if ($blocked) {
            return $this->error(
                'The office has already started on this one, so it can no longer be '
                . 'cancelled here. Please talk to the barangay if you no longer need it.',
                422,
            );
        }

        DB::transaction(function () use ($serviceRequest, $certificate) {
            $serviceRequest->update(['status' => 'Cancelled']);

            /* The certificate goes with it, or the counter still has something
               to print for a request the resident has withdrawn. */
            $certificate?->update(['status' => 'Cancelled']);
        });

        return $this->success($serviceRequest->fresh('certificate'), 'Request cancelled');
    }

    /**
     * And puts it back, having changed their mind again.
     *
     * Straight to Pending, which is where it began — not to whatever it was
     * before, because the only status it can be cancelled from is Pending.
     * Nothing is re-created and no number is re-drawn: this is the same
     * request it always was.
     */
    public function resume(ServiceRequest $serviceRequest)
    {
        if ($serviceRequest->resident_id !== $this->residentId()) {
            return $this->forbidden('This request does not belong to your account');
        }

        if ($serviceRequest->status !== 'Cancelled') {
            return $this->error('This request is not cancelled, so there is nothing to resume.', 422);
        }

        DB::transaction(function () use ($serviceRequest) {
            $serviceRequest->update(['status' => 'Pending']);
            $serviceRequest->certificate?->update(['status' => 'Pending']);
        });

        return $this->success($serviceRequest->fresh('certificate'), 'Request resumed');
    }
}
