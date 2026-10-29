<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Vawc\CaseFile;
use App\Models\Vawc\OnlineReport;
use App\Models\Vawc\ProtectionOrder;
use App\Services\Vawc\OnlineReports;
use Illuminate\Http\JsonResponse;

/**
 * Controller for Resident Portal VAWC Records.
 *
 * Provides endpoints for:
 * 1. Online complaints submitted by the resident
 * 2. Confidential cases involving the resident (as survivor or reporter)
 * 3. Barangay Protection Orders (BPO) issued/applied for the resident
 * 4. Tracking and timeline of actions (referrals, follow-ups, undertakings)
 */
class VawcRecordController extends PortalController
{
    public function index(): JsonResponse
    {
        $residentId = $this->residentId();
        if (! $residentId) {
            return $this->notFound('No resident record is linked to your account');
        }

        // 1. Online Reports submitted by this resident
        $reports = OnlineReport::where('resident_id', $residentId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (OnlineReport $r) => [
                'id' => $r->id,
                'reference_no' => $r->reference_no,
                'status' => $r->status,
                'sent_at' => $r->created_at?->toIso8601String(),
                'occurred_on' => $r->occurred_on?->toDateString(),
                'relationship' => $r->relationship,
                'respondent_name' => $r->respondent_name,
                'place' => $r->place,
                'visit_required' => $r->visit_required,
                'confirmed_in_person' => $r->confirmed_in_person,
                'narrative' => $r->narrative,
                'safe_contact' => $r->safe_contact,
                'safe_time' => $r->safe_time,
                'vawc_case_id' => $r->vawc_case_id,
                'office_note' => $r->office_note,
                'next_step' => OnlineReports::nextStep($r),
            ]);

        // 2. VAWC Cases where this resident is survivor, reporting resident, OR respondent
        $cases = CaseFile::where(function ($q) use ($residentId) {
                $q->where('survivor_id', $residentId)
                  ->orWhere('reported_by_resident_id', $residentId)
                  ->orWhere('respondent_id', $residentId);
            })
            ->with(['officer', 'respondent', 'protectionOrders', 'referrals', 'followups', 'agreement'])
            ->orderByDesc('created_at')
            ->get();

        $caseList = $cases->map(function (CaseFile $c) use ($residentId) {
            $myRole = 'Reporting Party';
            if ($c->survivor_id === $residentId) {
                $myRole = 'Survivor / Complainant';
            } elseif ($c->respondent_id === $residentId) {
                $myRole = 'Respondent';
            }

            return [
                'id' => $c->id,
                'case_code' => $c->case_code,
                'my_role' => $myRole,
                'reported_by_type' => $c->reported_by_type,
                'relationship_to_offender' => $c->relationship_to_offender,
                'violence_type' => $c->violence_type,
                'violence_types' => $c->violence_types ?? [],
                'risk_level' => $c->risk_level ?? 'Not Assessed',
                'currently_in_danger' => $c->currently_in_danger,
                'status' => $c->status,
                'report_date' => $c->report_date?->toIso8601String() ?? $c->created_at?->toIso8601String(),
                'closed_at' => $c->closed_at?->toIso8601String(),
                'respondent_name' => $c->respondent?->full_name ?? $c->reported_by_name ?? 'Confidential / On File',
                'assigned_officer' => $c->officer?->name ?? 'Barangay VAW Desk Officer',
                'protection_orders_count' => $c->protectionOrders->count(),
                'referrals_count' => $c->referrals->count(),
                'followups_count' => $c->followups->count(),
                'has_agreement' => $c->agreement !== null,
            ];
        });

        // 3. Protection Orders (BPO)
        $caseIds = $cases->pluck('id')->all();
        $orders = ProtectionOrder::whereIn('vawc_case_id', $caseIds)
            ->with('vawcCase')
            ->orderByDesc('id')
            ->get()
            ->map(fn (ProtectionOrder $po) => [
                'id' => $po->id,
                'case_code' => $po->vawcCase?->case_code,
                'vawc_case_id' => $po->vawc_case_id,
                'status' => $po->status,
                'applied_on' => $po->applied_on?->toDateString(),
                'issued_on' => $po->issued_on?->toDateString(),
                'expires_on' => $po->expires_on?->toDateString(),
                'issued_by' => $po->issued_by ?? 'Punong Barangay',
                'issued_by_name' => $po->issued_by_name,
                'in_effect' => (bool) $po->in_effect,
                'days_left' => $po->days_left,
                'notes' => $po->notes,
                'created_at' => $po->created_at?->toIso8601String(),
            ]);

        // 4. Tracking and Timeline Events
        $events = [];

        foreach ($cases as $c) {
            // Case Intake
            $events[] = [
                'case_code' => $c->case_code,
                'date' => $c->report_date?->toIso8601String() ?? $c->created_at?->toIso8601String(),
                'event_type' => 'Case Intake',
                'title' => 'VAWC Case Registered',
                'status' => $c->status,
                'details' => 'Case officially registered at the Barangay VAW Desk (' . ($c->violence_type ?? 'VAWC Incident') . '). Assigned Officer: ' . ($c->officer?->name ?? 'Barangay VAW Desk Officer'),
                'badge' => 'primary',
            ];

            // BPO orders
            foreach ($c->protectionOrders as $po) {
                $events[] = [
                    'case_code' => $c->case_code,
                    'date' => $po->issued_on ? $po->issued_on->toIso8601String() : ($po->applied_on ? $po->applied_on->toIso8601String() : $po->created_at?->toIso8601String()),
                    'event_type' => 'Protection Order (BPO)',
                    'title' => 'BPO Status: ' . $po->status,
                    'status' => $po->status,
                    'details' => $po->issued_on
                        ? "Barangay Protection Order issued by {$po->issued_by} ({$po->issued_by_name}). Valid until {$po->expires_on->toDateString()} (" . ($po->in_effect ? "{$po->days_left} day(s) remaining" : "Expired") . ")."
                        : "Barangay Protection Order application recorded on {$po->applied_on?->toDateString()}.",
                    'badge' => $po->status === 'Issued' ? 'success' : 'warning',
                ];
            }

            // Referrals
            foreach ($c->referrals as $ref) {
                $events[] = [
                    'case_code' => $c->case_code,
                    'date' => $ref->referral_date?->toIso8601String() ?? $ref->created_at?->toIso8601String(),
                    'event_type' => 'Agency Referral',
                    'title' => 'Referred to ' . $ref->referral_agency,
                    'status' => $ref->referral_status,
                    'details' => "Referral reason: {$ref->referral_reason}. Status: {$ref->referral_status}." . ($ref->outcome ? " Outcome: {$ref->outcome}" : ""),
                    'badge' => 'info',
                ];
            }

            // Safety Follow-ups
            foreach ($c->followups as $fol) {
                $events[] = [
                    'case_code' => $c->case_code,
                    'date' => $fol->followup_date?->toIso8601String() ?? $fol->created_at?->toIso8601String(),
                    'event_type' => 'Safety Follow-up',
                    'title' => 'Safety Monitoring (' . ($fol->followup_type ?? 'Check-in') . ')',
                    'status' => $fol->safety_status ?? 'Monitored',
                    'details' => "Safety assessment: {$fol->safety_status}." . ($fol->next_action ? " Next action: {$fol->next_action}" : ""),
                    'badge' => 'secondary',
                ];
            }

            // Agreement / Dialogue Undertaking
            if ($c->agreement) {
                $events[] = [
                    'case_code' => $c->case_code,
                    'date' => $c->agreement->session_date?->toIso8601String() ?? $c->agreement->created_at?->toIso8601String(),
                    'event_type' => 'Dialogue Undertaking',
                    'title' => 'Dialogue & Understanding',
                    'status' => $c->agreement->outcome ?? 'Completed',
                    'details' => "Dialogue conducted with outcome: {$c->agreement->outcome}. Undertaking noted at the VAW Desk.",
                    'badge' => 'success',
                ];
            }
        }

        // Sort events newest first
        usort($events, fn ($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));

        return $this->success([
            'reports' => $reports,
            'cases' => $caseList,
            'protection_orders' => $orders,
            'tracking' => $events,
        ], 'VAWC records retrieved');
    }
}

