<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Http\Controllers\Api\BaseController;
use App\Models\Content\Announcement;
use App\Models\Records\AdministrativeRecord;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;

class ExecutiveController extends BaseController
{
    /**
     * Punong Barangay executive view (module 1.6): everything waiting on the
     * PB plus the barangay-wide service picture — workload, aging requests,
     * most-requested services and the latest directives.
     */
    public function show()
    {
        $openStatuses = ['Pending', 'In Progress'];
        $open = ServiceRequest::whereIn('status', $openStatuses)->get();

        // Aging buckets on still-open requests — the PB's early warning that
        // something is stuck at a counter.
        $ageInDays = fn ($r) => $r->created_at->diffInDays(now());
        $aging = [
            '0-3 days' => $open->filter(fn ($r) => $ageInDays($r) <= 3)->count(),
            '4-7 days' => $open->filter(fn ($r) => $ageInDays($r) > 3 && $ageInDays($r) <= 7)->count(),
            '8-14 days' => $open->filter(fn ($r) => $ageInDays($r) > 7 && $ageInDays($r) <= 14)->count(),
            '15+ days' => $open->filter(fn ($r) => $ageInDays($r) > 14)->count(),
        ];
        $oldest = $open->sortBy('created_at')->first();

        return $this->success([
            // Administrative documents the PB has still to adopt.
            'documents_awaiting_signature' => AdministrativeRecord::with('creator:id,name')
                ->whereNull('approved_at')
                ->where('is_archived', false)
                ->orderBy('document_date')
                ->limit(8)
                ->get(['id', 'document_type', 'document_number', 'document_title', 'document_date', 'created_by']),
            'documents_awaiting_count' => AdministrativeRecord::whereNull('approved_at')
                ->where('is_archived', false)
                ->count(),

            // Where the open work is sitting right now.
            'office_workload' => $open->groupBy('office')->map(fn ($group) => [
                'pending' => $group->where('status', 'Pending')->count(),
                'in_progress' => $group->where('status', 'In Progress')->count(),
                'total' => $group->count(),
            ]),

            'aging_requests' => $aging,
            'oldest_open_request' => $oldest ? [
                'request_number' => $oldest->request_number,
                'service_type' => $oldest->service_type,
                'office' => $oldest->office,
                'days_open' => (int) round($ageInDays($oldest)),
            ] : null,

            // What residents actually come in for, this year.
            'frequently_requested' => ServiceRequest::whereYear('created_at', date('Y'))
                ->groupBy('service_type')
                ->selectRaw('service_type, count(*) as count')
                ->orderByDesc('count')
                ->limit(6)
                ->get(),

            'service_statistics' => [
                'open_requests' => $open->count(),
                'completed_this_month' => ServiceRequest::where('status', 'Completed')
                    ->whereMonth('created_at', date('m'))
                    ->whereYear('created_at', date('Y'))
                    ->count(),
                'certificates_released_this_month' => Certificate::where('status', 'Released')
                    ->whereMonth('released_at', date('m'))
                    ->whereYear('released_at', date('Y'))
                    ->count(),
                'residents_served_this_month' => ServiceRequest::whereMonth('created_at', date('m'))
                    ->whereYear('created_at', date('Y'))
                    ->whereNotNull('resident_id')
                    ->distinct('resident_id')
                    ->count('resident_id'),
            ],

            // Executive instructions are filed as EOs/memoranda; announcements
            // are the public-facing side of the same voice.
            'recent_directives' => AdministrativeRecord::whereIn('document_type', ['Executive Order', 'Memorandum'])
                ->whereNotNull('approved_at')
                ->orderByDesc('document_date')
                ->limit(5)
                ->get(['id', 'document_type', 'document_number', 'document_title', 'document_date']),
            'announcements' => Announcement::orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'title', 'created_at']),
        ], 'Executive summary retrieved');
    }
}
