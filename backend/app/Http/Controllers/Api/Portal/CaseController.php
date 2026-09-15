<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Blotter\Blotter;
use App\Models\Lupon\CaseFile;

class CaseController extends PortalController
{
    /**
     * The resident's own cases — what they filed, and what was filed on them.
     *
     * WHAT IS NOT HERE MATTERS MORE THAN WHAT IS.
     *
     * There is no VAWC. Not the case, not its status, not the fact that one
     * exists. The person a survivor is escaping usually lives in the same
     * house and often uses the same phone, and a line reading "VAWC case —
     * Active" on a portal anybody in that house can open is how somebody gets
     * hurt. RA 9262 makes those records confidential; this endpoint keeps
     * them that way by never asking for them. Follow-up happens at the desk,
     * in person, which is the only place it is safe.
     *
     * KP cases and blotters are different: summons are served at the door and
     * the process is adversarial and open by design. But a KP case has TWO
     * sides, so each side sees their own view — a respondent is told when to
     * appear, never where the complainant lives.
     */
    public function index()
    {
        $residentId = $this->residentId();

        if (!$residentId) {
            return $this->notFound('No resident record is linked to your account');
        }

        $kp = CaseFile::where('complainant_id', $residentId)
            ->orWhereHas('respondents', fn ($q) => $q->where('residents.id', $residentId))
            ->with([
                'complaint:id,lupon_case_id,date_of_occurrence,place_of_occurrence',
                'hearings' => fn ($q) => $q->orderBy('scheduled_at'),
                'settlement',
            ])
            ->orderByDesc('date_filed')
            ->get()
            ->map(function ($case) use ($residentId) {
                $mine = $case->complainant_id === $residentId ? 'Complainant' : 'Respondent';

                // The next thing they have to turn up for.
                $next = $case->hearings
                    ->firstWhere(fn ($h) => $h->status === 'Scheduled' && $h->scheduled_at?->isFuture());

                return [
                    'case_number' => $case->case_number,
                    'title' => $case->case_title,
                    'classification' => $case->case_classification,
                    'my_role' => $mine,
                    'stage' => $case->current_stage,
                    'date_filed' => $case->date_filed?->toDateString(),
                    'date_resolved' => $case->date_resolved?->toDateString(),
                    'occurred_on' => $case->complaint?->date_of_occurrence?->toDateString(),
                    'place' => $case->complaint?->place_of_occurrence,
                    /*
                     * The other side is named — they must be, a person is
                     * entitled to know who they are in a dispute with — but
                     * never their address or number. That is the difference
                     * between telling somebody who complained and telling
                     * them where to find them.
                     */
                    'other_party' => $mine === 'Complainant'
                        ? $case->respondents->map(fn ($r) => $r->full_name)->join(', ')
                        : ($case->complainant?->full_name ?: $case->complainant_name),
                    'next_hearing' => $next ? [
                        'type' => $next->hearing_type,
                        'scheduled_at' => $next->scheduled_at?->toDateTimeString(),
                        'summons_served' => $next->summons_served_date?->toDateString(),
                    ] : null,
                    'hearings_held' => $case->hearings->where('status', 'Completed')->count(),
                    'settlement' => $case->settlement ? [
                        'type' => $case->settlement->settlement_type,
                        'agreed_on' => $case->settlement->date_agreed?->toDateString(),
                        'status' => $case->settlement->status,
                        // The two documents that decide what happens next.
                        'certificate_to_file_action' => (bool) $case->settlement->cfa_issued,
                    ] : null,
                ];
            })
            ->values();

        $blotters = Blotter::where('reporter_id', $residentId)
            ->orWhereHas('people', fn ($q) => $q->where('resident_id', $residentId))
            ->orderByDesc('recorded_at')
            ->get()
            ->map(fn ($entry) => [
                'blotter_number' => $entry->blotter_number,
                'recorded_at' => $entry->recorded_at?->toDateTimeString(),
                'incident_at' => $entry->incident_at?->toDateTimeString(),
                'incident_type' => $entry->incident_type,
                'place' => $entry->place_of_incident,
                'my_role' => $entry->reporter_id === $residentId
                    ? 'Reported it'
                    : 'Named in the entry',
                'action_taken' => $entry->action_taken,
                'status' => $entry->status,
                // Deliberately no narrative: what one person told the desk
                // about another is not for the other to read from home.
            ])
            ->values();

        return $this->success([
            'kp_cases' => $kp,
            'blotters' => $blotters,
        ], 'Your cases retrieved');
    }
}
