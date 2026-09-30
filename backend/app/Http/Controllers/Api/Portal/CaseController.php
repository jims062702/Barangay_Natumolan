<?php

namespace App\Http\Controllers\Api\Portal;

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
     * A KP case is different: summons are served at the door and the
     * process is adversarial and open by design. But a KP case has TWO
     * sides, so each side sees their own view — a respondent is told when to
     * appear, never where the complainant lives.
     */
    public function index()
    {
        $residentId = $this->residentId();

        if (!$residentId) {
            return $this->notFound('No resident record is linked to your account');
        }

        $kp = CaseFile::where(fn ($q) => $q->where('complainant_id', $residentId)
                ->orWhereHas('respondents', fn ($r) => $r->where('residents.id', $residentId)))
            /* On their portal once the summons is PRINTED — see summonsIssued(). */
            ->summonsIssued()
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
                    /*
                     * Every sitting, not only the next one.
                     *
                     * A person summoned to appear is entitled to the whole
                     * schedule — what was held, what was stood down, and what
                     * is still to come. WITHOUT THE MINUTES: what was said in
                     * a mediation is the Punong Barangay's record of the
                     * session, and handing one side a transcript to read at
                     * home is not the same as telling them when to turn up.
                     */
                    'hearings' => $case->hearings->map(fn ($h) => [
                        'type' => $h->hearing_type,
                        'scheduled_at' => $h->scheduled_at?->toDateTimeString(),
                        'status' => $h->status,
                        'summons_served' => $h->summons_served_date?->toDateString(),
                        /*
                         * THEIR OWN attendance, not both sides'.
                         *
                         * The record holds complainant_present and
                         * respondent_present; which of those is "you" depends
                         * on the side this reader is on, and that is worked
                         * out here rather than sent raw — a resident reading
                         * their own record should not be handed the other
                         * party's attendance to interpret.
                         *
                         * Null means the sitting has not been minuted yet,
                         * which is not the same as "did not attend".
                         */
                        'i_attended' => $mine === 'Complainant'
                            ? $h->complainant_present
                            : $h->respondent_present,
                    ])->values(),
                    /*
                     * What has happened to this case, in order.
                     *
                     * Built from the case's own dates rather than kept as a
                     * log: every entry here is a fact the record already
                     * holds, so the two can never drift apart.
                     */
                    'history' => self::historyOf($case, $mine),
                    'settlement' => $case->settlement ? [
                        'type' => $case->settlement->settlement_type,
                        'agreed_on' => $case->settlement->date_agreed?->toDateString(),
                        'status' => $case->settlement->status,
                    ] : null,
                ];
            })
            ->values();

        return $this->success([
            'kp_cases' => $kp,
        ], 'Your cases retrieved');
    }

    /**
     * What has happened to one case, oldest first — one row per event.
     *
     * Derived from the record rather than kept as a separate log, so there is
     * no second version of the story to fall out of step with the first.
     *
     * FOUR FIELDS, not a sentence. `event` says what kind of thing happened,
     * `status` how it went, `description` is the line a person reads, and
     * `on` is when. As one string the reader had to parse it and no column
     * could be scanned down.
     *
     * Nothing here reveals the other party's address or what was said in a
     * session — the same line the rest of this controller holds.
     *
     * @param string $mine 'Complainant' or 'Respondent' — the reader's side,
     *                     which changes how the filing reads to them.
     */
    private static function historyOf($case, string $mine): array
    {
        $events = [];

        if ($case->date_filed) {
            $events[] = [
                'on' => $case->date_filed->toDateString(),
                'event' => 'Complaint filed',
                'status' => 'Filed',
                /* The same fact, from the side the reader is on. */
                'description' => $mine === 'Complainant'
                    ? 'You brought this complaint to the Lupon office.'
                    : 'A complaint naming you was filed at the Lupon office.',
            ];
        }

        foreach ($case->hearings as $hearing) {
            $when = $hearing->scheduled_at;

            if (! $when) {
                continue;
            }

            /* A summons is its own event: being told to appear is not the
               same as the sitting itself, and it happens on its own day. */
            if ($hearing->summons_served_date) {
                $events[] = [
                    'on' => $hearing->summons_served_date->toDateString(),
                    'event' => 'Summons served',
                    'status' => 'Served',
                    'description' => 'You were served notice to appear at the '
                        . strtolower($hearing->hearing_type) . ' on '
                        . $when->format('j M Y') . '.',
                ];
            }

            $events[] = [
                'on' => $when->toDateString(),
                'event' => $hearing->hearing_type . ' session',
                'status' => $hearing->status,
                'description' => match ($hearing->status) {
                    'Completed' => 'The session was held'
                        . ($hearing->outcome ? ' — ' . $hearing->outcome . '.' : '.'),
                    'Cancelled' => 'The session was stood down. You did not need to attend.',
                    'Rescheduled' => 'The session was moved to another day.',
                    'No Show' => 'A party did not appear.',
                    /* Still ahead: written as a future, not as something done. */
                    default => 'Set for ' . $when->format('j M Y, g:i a')
                        . ' with the '
                        . ($hearing->hearing_type === 'Mediation'
                            ? 'Punong Barangay.'
                            : 'Lupon panel.'),
                },
            ];
        }

        if ($case->settlement?->date_agreed) {
            $events[] = [
                'on' => $case->settlement->date_agreed->toDateString(),
                'event' => 'Settlement',
                'status' => $case->settlement->status,
                'description' => 'An agreement was reached and recorded as a '
                    . strtolower($case->settlement->settlement_type) . '.',
            ];
        }

        if ($case->date_resolved) {
            $events[] = [
                'on' => $case->date_resolved->toDateString(),
                'event' => 'Case closed',
                'status' => $case->current_stage,
                'description' => match ($case->current_stage) {
                    'Settled' => 'Closed because the parties agreed.',
                    'Dismissed' => 'Closed without an agreement.',
                    'Referred' => 'Sent on to another office.',
                    default => 'The case was closed.',
                },
            ];
        }

        usort($events, fn ($a, $b) => strcmp($a['on'], $b['on']));

        return $events;
    }
}