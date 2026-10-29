<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\OnlineReport;
use App\Services\Vawc\OnlineReports;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * The VAW Desk's queue of reports sent online by residents.
 *
 * The list says who and when, and whether she was threatened — enough to
 * choose which to open first. What she wrote is read by opening it, and
 * every opening, and every look at her ID, goes on the report's trail.
 *
 * Verifying one opens a VAWC case (OnlineReports::accept) — with the
 * respondent the desk finds on the register for the person she named, as the
 * Lupon does with its online complaints. A report with no threat in it is
 * verified only once she has confirmed it in person.
 */
class OnlineReportController extends BaseController
{
    public function index(Request $request)
    {
        $reports = OnlineReport::with(['resident:id,first_name,middle_name,last_name,suffix,resident_number,zone_purok',
            'respondent:id,first_name,middle_name,last_name,suffix,resident_number,zone_purok', 'vawcCase:id,case_code', 'reviewer:id,name'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            /* Waiting first; within that, a threat before anything else, then oldest. */
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [OnlineReport::FOR_VERIFICATION])
            ->orderByRaw('CASE WHEN threatened = 1 OR in_danger_now = 1 THEN 0 ELSE 1 END')
            ->orderBy('created_at')
            ->get()
            ->map(fn (OnlineReport $r) => [
                'id' => $r->id,
                'reference_no' => $r->reference_no,
                'status' => $r->status,
                'sent_at' => $r->created_at?->toIso8601String(),
                'filed_via' => $r->filed_via,
                'resident' => $r->resident ? [
                    'id' => $r->resident->id,
                    'name' => $r->resident->full_name,
                    'resident_number' => $r->resident->resident_number,
                    'zone_purok' => $r->resident->zone_purok,
                    'birthdate' => $r->resident->birthdate?->toDateString(),
                    'is_minor' => $r->resident->isMinor(),
                    'age' => $r->resident->birthdate?->age,
                ] : null,
                /* As she wrote it — the register's record is chosen when it is verified. */
                'respondent_name' => $r->respondent_name,
                'respondent' => $r->respondent ? [
                    'id' => $r->respondent->id,
                    'name' => $r->respondent->full_name,
                    'resident_number' => $r->respondent->resident_number,
                    'zone_purok' => $r->respondent->zone_purok,
                ] : null,
                'threatened' => $r->threatened,
                'in_danger_now' => $r->in_danger_now,
                'visit_required' => $r->visit_required,
                'case_code' => $r->vawcCase?->case_code,
                'vawc_case_id' => $r->vawc_case_id,
            ]);

        return $this->success($reports, 'Online reports');
    }

    public function show(OnlineReport $report)
    {
        $report->load(['resident:id,first_name,middle_name,last_name,suffix,resident_number,zone_purok,address,contact_number,birthdate,gender',
            'respondent:id,first_name,middle_name,last_name,suffix,resident_number,zone_purok,gender,record_type',
            'card:id,status,issued_at,issued_via', 'vawcCase:id,case_code', 'reviewer:id,name']);
        $report->logView('viewed');

        return $this->success([
            ...$report->toArray(),
            'resident' => $report->resident ? [...$report->resident->toArray(), 'full_name' => $report->resident->full_name] : null,
            'respondent' => $report->respondent ? [...$report->respondent->toArray(), 'full_name' => $report->respondent->full_name] : null,
            'next_step' => OnlineReports::nextStep($report),
        ], 'Online report');
    }

    /** Her Resident ID, from the private disk — looked at, and written down. */
    public function validId(OnlineReport $report)
    {
        if (str_starts_with($report->id_path, 'http://') || str_starts_with($report->id_path, 'https://')) {
            $resp = \Illuminate\Support\Facades\Http::get($report->id_path);
            if ($resp->successful()) {
                $report->logView('id_viewed');
                return response($resp->body(), 200, [
                    'Content-Type' => $resp->header('Content-Type') ?: 'image/jpeg',
                ]);
            }
        }

        if (! Storage::disk('local')->exists($report->id_path)) {
            return $this->notFound('The uploaded ID is no longer on file.');
        }

        $report->logView('id_viewed');

        return Storage::disk('local')->response($report->id_path);
    }

    public function accept(Request $request, OnlineReport $report, OnlineReports $reports)
    {
        $data = $request->validate([
            'confirmed_in_person' => 'required|boolean',
            /* The person she named, found on the register by the desk. */
            'respondent_id' => 'required|integer',
            'note' => 'nullable|string|max:500',
        ], [
            'respondent_id.required' => 'Choose the respondent from the register — search for the person she named.',
        ]);

        if (! $report->resident) {
            return $this->error('The complainant of this report is no longer on the register.', 422);
        }

        [$respondent, $problem] = OnlineReports::respondentFor($data['respondent_id'], $report->resident);
        if ($problem) {
            return $this->error($problem, 422, ['respondent_id' => [$problem]]);
        }

        try {
            $case = $reports->accept($report, (bool) $data['confirmed_in_person'], $data['note'] ?? null, $request->user(), $respondent);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success(['case_id' => $case->id, 'case_code' => $case->case_code],
            'Verified. Case ' . $case->case_code . ' is open, with ' . $respondent->full_name
                . ' as the respondent — complete the assessment on the case page.');
    }

    public function decline(Request $request, OnlineReport $report, OnlineReports $reports)
    {
        $data = $request->validate([
            'reason' => 'required|string|min:5|max:500',
        ], ['reason.required' => 'Say why, in words she can act on — she reads this on her portal.']);

        try {
            $reports->decline($report, $data['reason'], $request->user());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success(null, 'Report declined.');
    }
}
