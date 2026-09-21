<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\Visit;
use App\Models\Lupon;
use App\Models\Lupon\Payment as LuponPayment;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Models\Vawc;

/** The signed-in staff member's landing numbers: their office's stats and waiting work. */
class SummaryController extends BaseController
{
    /**
     * What residents actually come in for, this year.
     *
     * Its own endpoint rather than a field on the executive summary, because
     * the COUNTER needs it too. The clerk who issues these documents all day
     * should be able to see which ones, and reaching that figure through the
     * Punong Barangay's summary would have meant handing a clerk the office
     * workload, the aging backlog and the executive directives with it.
     *
     * Six, ordered, because the point is which ones lead — a ranked list
     * with a long tail is read at the top and nowhere else.
     */
    public function requestedServices()
    {
        $rows = ServiceRequest::whereYear('created_at', date('Y'))
            ->groupBy('service_type')
            ->selectRaw('service_type, count(*) as count')
            ->orderByDesc('count')
            ->limit(6)
            ->get();

        return $this->success([
            'services' => $rows,
            'year' => (int) date('Y'),
        ], 'Requested services retrieved');
    }

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

        /*
         * Lupon fees waiting at this counter.
         *
         * The Clerk collects them now — ₱20 to file a case, ₱230 to certify a
         * failed conciliation to court — and each one sitting here is a Lupon
         * case standing still: the summons cannot be issued until it is paid.
         * It was the one piece of the Clerk's work with no figure anywhere.
         *
         * It replaces two tiles that both counted service requests. A request
         * raises its certificate the moment it is made, so they were the same
         * work as "certificates to start", under an earlier name, linking to
         * a queue that is no longer on the menu.
         */
        if ($user->office === 'Main Office' || $user->role === 'Punong Barangay') {
            $pending['lupon_fees_waiting'] = LuponPayment::where('status', 'Requested')->count();
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

        /*
         * CERTIFICATES, not service requests.
         *
         * The counter issues documents: a request for one raises the
         * certificate the moment it is made, so the request list was the
         * same work under an earlier name — and the page it linked to came
         * off the Clerk's menu. What the clerk wants on opening the day is
         * the last few certificates and where each has got to.
         */
        $activities['recent_certificates'] = Certificate::with([
                'resident:id,first_name,middle_name,last_name,suffix',
            ])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'certificate_number', 'certificate_type', 'status', 'resident_id', 'created_at'])
            ->map(fn ($c) => [
                'id' => $c->id,
                'certificate_number' => $c->certificate_number,
                'certificate_type' => $c->certificate_type,
                'status' => $c->status,
                'resident' => $c->resident?->full_name,
                'created_at' => $c->created_at,
            ]);

        return $activities;
    }
}
