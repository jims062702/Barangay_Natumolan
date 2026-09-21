<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Content\Announcement;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;

class DashboardController extends PortalController
{
    public function show()
    {
        $residentId = $this->residentId();
        $user = auth()->user()->load('resident:id,resident_number,first_name,last_name,zone_purok');

        return $this->success([
            'resident' => $user->resident,
            'stats' => [
                'active_requests' => ServiceRequest::where('resident_id', $residentId)
                    ->whereNotIn('status', ['Completed', 'Rejected', 'Cancelled'])->count(),
                'total_requests' => ServiceRequest::where('resident_id', $residentId)->count(),
                'certificates_ready' => Certificate::where('resident_id', $residentId)
                    ->where('status', 'Ready to Claim')->count(),
            ],
            'recent_requests' => ServiceRequest::where('resident_id', $residentId)
                ->latest()->orderByDesc('id')->limit(5)->get(),
            /* An expired advisory is dropped by the scope — see Announcement. */
            'announcements' => Announcement::public()->with('creator:id,name')
                ->orderByDesc('published_at')->limit(4)->get(),
        ], 'Portal dashboard retrieved');
    }
}
