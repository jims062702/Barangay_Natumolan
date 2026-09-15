<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\Visit;
use App\Models\Lupon;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Models\Vawc;

/** The signed-in staff member's landing numbers: their office's stats and waiting work. */
class SummaryController extends BaseController
{
    /**
     * Get dashboard summary
     */
    public function summary()
    {
        $user = auth()->user();

        return $this->success([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'office' => $user->office,
                'role' => $user->role,
            ],
            'quick_stats' => $this->quickStats($user),
            'recent_activity' => $this->recentActivity($user),
        ], 'Dashboard summary retrieved');
    }

    /**
     * Get pending items for dashboard
     */
    public function pendingItems()
    {
        $user = auth()->user();

        $pending = [];

        /*
         * Main Office worklists. Both counters used to name statuses the
         * column never held ('Approval', 'Verification'), so they always read
         * zero; they now track the two places work actually piles up:
         * requests nobody has started, and finished documents waiting to be
         * collected.
         */
        if ($user->office === 'Main Office' || $user->role === 'Punong Barangay') {
            $pending['pending_certificates'] = Certificate::where('status', 'Pending')
                ->count();
            $pending['ready_to_claim'] = Certificate::where('status', 'Ready to Claim')
                ->count();
        }

        // VAWC active cases
        if ($user->office === 'VAWC') {
            $pending['active_cases'] = Vawc\CaseFile::where('status', 'Active')
                ->where('assigned_vawc_officer', $user->id)
                ->count();
        }

        // Lupon pending hearings
        if ($user->office === 'Lupon') {
            $pending['pending_hearings'] = Lupon\CaseFile::whereIn('current_stage', ['Mediation', 'Conciliation'])
                ->count();
        }

        // Service requests pending assignment
        if (in_array($user->role, ['Secretary', 'Clerk'])) {
            $pending['unassigned_requests'] = ServiceRequest::where('status', 'Pending')
                ->whereNull('assigned_to')
                ->count();
        }

        return $this->success($pending, 'Pending items retrieved');
    }

    private function quickStats($user)
    {
        $stats = [];

        // General stats
        $stats['pending_requests'] = ServiceRequest::where('status', 'Pending')->count();
        $stats['monthly_certificates'] = Certificate::whereMonth('created_at', date('m'))
            ->whereYear('created_at', date('Y'))
            ->count();

        // Office-specific stats
        if ($user->office === 'VAWC') {
            $stats['active_cases'] = Vawc\CaseFile::where('status', 'Active')->count();
        } elseif ($user->office === 'Lupon') {
            $stats['pending_cases'] = Lupon\CaseFile::whereIn('current_stage', ['Filed', 'Mediation'])->count();
        } elseif ($user->office === 'Health Station') {
            $stats['today_visits'] = Visit::whereDate('visit_date', today())->count();
        }

        return $stats;
    }

    private function recentActivity($user)
    {
        $activities = [];

        $activities['recent_requests'] = ServiceRequest::where('office', $user->office)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get(['id', 'request_number', 'service_type', 'status', 'created_at']);

        return $activities;
    }
}
