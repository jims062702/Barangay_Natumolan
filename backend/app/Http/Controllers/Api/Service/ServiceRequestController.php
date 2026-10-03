<?php

namespace App\Http\Controllers\Api\Service;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Service\StoreServiceRequestRequest;
use App\Http\Requests\Service\UpdateServiceRequestRequest;
use App\Models\Account\Notification;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Http\Request;

/** Request intake at the counter — the Clerk's, and the PB's to oversee. */
class ServiceRequestController extends BaseController
{
    /** The only service a non-resident may ask the barangay for. */
    public const COMPLAINT = 'Complaint';

    public function index(Request $request)
    {
        /* The certificate's typed-in person, for a walk-in the register does
           not list yet — the request itself has nobody to name. */
        $query = ServiceRequest::with([
            'resident', 'assignedUser',
            /* Qualified: `certificate` is a latestOfMany, which joins the table
               to itself, and a bare column list is ambiguous there. */
            'certificate' => fn ($q) => $q->select(
                'certificates_clearances.id',
                'certificates_clearances.service_request_id',
                'certificates_clearances.unlisted_person',
            ),
        ]);
        
        if ($request->has('office')) {
            $query->where('office', $request->office);
        }
        
        /*
         * Counted before the status filter narrows it, so every chip reports
         * its own total rather than zero-except-the-one-you-picked.
         */
        $counts = $this->statusCounts($query);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('request_type')) {
            $query->where('request_type', $request->request_type);
        }

        if ($request->filled('resident_id')) {
            $query->where('resident_id', $request->resident_id);
        }

        // First Come, First Served priority based on actual request/filing timestamp (created_at ASC, id ASC)
        if ($request->input('status') === 'Pending' || $request->input('order') === 'fcfs' || $request->input('sort') === 'fcfs') {
            $query->orderBy('created_at', 'asc')->orderBy('id', 'asc');
        } elseif ($request->filled('status') && in_array($request->status, ['Completed', 'Rejected', 'Cancelled'])) {
            $query->orderBy('created_at', 'desc')->orderBy('id', 'desc');
        } else {
            // Prioritize pending/in progress requests in first-come first-served order
            $query->orderByRaw("CASE WHEN status IN ('Pending', 'In Progress') THEN 0 ELSE 1 END ASC")
                ->orderBy('created_at', 'asc')
                ->orderBy('id', 'asc');
        }

        $requests = $query->paginate(20);

        return $this->success(
            $requests->toArray() + ['counts' => $counts],
            'Service requests retrieved'
        );
    }

    public function store(StoreServiceRequestRequest $request)
    {
        $validated = $request->validated();

        /*
         * The one thing somebody who does not live here may still do.
         *
         * A non-resident cannot be issued anything by this barangay — but a
         * person wronged by a resident has to be able to say so, whoever they
         * are and wherever they live. Refusing a complaint because the
         * complainant lives in the next town would close the only door the
         * Katarungang Pambarangay leaves open to them.
         *
         * So: complaints yes, everything else no.
         */
        if (!empty($validated['resident_id'])) {
            $applicant = Resident::find($validated['resident_id']);

            if ($applicant?->isNonResident() && $validated['service_type'] !== self::COMPLAINT) {
                return $this->error(
                    $applicant->full_name . ' lives outside Barangay Natumolan and is on the '
                        . 'register only as a relative of a resident. The barangay cannot issue '
                        . 'them a certificate or clearance. A complaint against a resident is the '
                        . 'one request they may file.',
                    422
                );
            }
        }

        $validated['request_number'] = ServiceRequest::nextNumber();

        // Walk-ins are being served at the desk right now → In Progress,
        // assigned to the staff member recording them. Online requests
        // arrive Pending until the clerk starts processing them.
        if ($validated['request_type'] === 'Walk-in') {
            $validated['status'] = 'In Progress';
            $validated['assigned_to'] = auth()->id();
        } else {
            $validated['status'] = 'Pending';
        }

        $serviceRequest = ServiceRequest::create($validated);

        // A walk-in cert-type request is already "In Progress" — file its
        // certificate right away so it shows in Certificates & Clearances,
        // exactly like an online request when the clerk starts processing.
        if ($serviceRequest->status === 'In Progress') {
            $this->fileCertificateApplication($serviceRequest);
        }
        $serviceRequest->load('certificate');

        return $this->success($serviceRequest, 'Service request created', 201);
    }

    public function show(ServiceRequest $serviceRequest)
    {
        $serviceRequest->load(['resident', 'certificate', 'referrals']);
        return $this->success($serviceRequest, 'Service request retrieved');
    }

    public function update(UpdateServiceRequestRequest $request, ServiceRequest $serviceRequest)
    {
        $validated = $request->validated();

        $statusChanged = isset($validated['status']) && $validated['status'] !== $serviceRequest->status;

        if (($validated['status'] ?? null) === 'Completed' && !$serviceRequest->completed_at) {
            $validated['completed_at'] = now();
        }

        $serviceRequest->update($validated);

        // Starting to process a certificate-type request puts the
        // certificate on the clerk's desk automatically — it appears in
        // Certificates & Clearances already being processed, with no
        // separate "+ New certificate" step for the clerk.
        if ($statusChanged && $serviceRequest->status === 'In Progress') {
            $this->fileCertificateApplication($serviceRequest);
        }

        if ($statusChanged) {
            Notification::notifyResident(
                $serviceRequest->resident_id,
                'request_status',
                'Request ' . $serviceRequest->request_number . ' is now ' . $serviceRequest->status,
                'Your ' . $serviceRequest->service_type . ' request status changed to "' . $serviceRequest->status . '".',
                'service_request',
                $serviceRequest->id
            );
        }

        // `certificate` lets the frontend confirm the auto-filed application.
        $serviceRequest->load('certificate');

        return $this->success($serviceRequest, 'Service request updated');
    }

    public function destroy(ServiceRequest $serviceRequest)
    {
        $serviceRequest->delete();
        return $this->success(null, 'Service request deleted');
    }

    public function status(ServiceRequest $serviceRequest)
    {
        return $this->success([
            'request_number' => $serviceRequest->request_number,
            'status' => $serviceRequest->status,
            'office' => $serviceRequest->office,
            'service_type' => $serviceRequest->service_type,
            'created_at' => $serviceRequest->created_at,
            'completed_at' => $serviceRequest->completed_at,
        ], 'Request status retrieved');
    }

    /**
     * Puts a certificate-type request on the clerk's desk. Skipped for
     * non-certificate services and unlinked requests.
     *
     * A resident who asked online already has a Pending certificate waiting
     * (the portal raises it when the request is made), and moving the request to
     * In Progress IS the clerk accepting it — so that one is advanced rather
     * than duplicated, keeping the request and the document in step.
     */
    private function fileCertificateApplication(ServiceRequest $serviceRequest): void
    {
        $type = CertificateCatalogue::SERVICE_TYPES[$serviceRequest->service_type] ?? null;

        if (!$type || !$serviceRequest->resident_id) {
            return;
        }

        $existing = $serviceRequest->certificate()->first();

        if ($existing) {
            if ($existing->status === 'Pending') {
                $existing->update([
                    'status' => 'Processing',
                    'processed_by' => auth()->id(),
                    'processed_at' => now(),
                ]);
            }

            return;
        }

        Certificate::raiseFor($serviceRequest, $type, [
            'purpose' => $serviceRequest->purpose ?: $type,
            /* Provisional until the clerk picks the ordinance's purpose. */
            'fee_amount' => CertificateCatalogue::feeFor($type, $serviceRequest->purpose) ?? 0,
            // The clerk is working on it right now — no queue, no decision.
            'status' => 'Processing',
            'processed_by' => auth()->id(),
            'processed_at' => now(),
        ]);
    }
}
