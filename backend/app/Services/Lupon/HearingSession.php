<?php

namespace App\Services\Lupon;

use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * A sitting that is actually held: the minutes, and what came of it.
 *
 * The desk presses Start when the parties are in the room and writes the
 * minutes as it goes. There are two ways a sitting can end, and each one
 * does something to the case rather than only to the hearing:
 *
 *   Unsettled   nothing is agreed; the next sitting stands — and if this
 *               was the LAST of the three, the case moves on by itself
 *   Agreement   the terms are recorded as the settlement, the case closes
 *               and the sittings still on the calendar are stood down
 *
 * THERE IS NO "MOVE TO THE LUPON" TO CHOOSE ANY MORE. The barangay gives
 * the Punong Barangay three Tuesdays and the parties are entitled to all
 * three; a button that ended mediation early let one sitting decide what
 * the law gives three. The case moves when the three are spent, and the
 * record shows three sittings held — which is what the certificate to file
 * action eventually has to rest on.
 *
 * The outcome is a choice, never typed: "settled" written into a free box
 * closed nothing, and three more sittings stayed on the calendar for a case
 * that was over.
 */
final class HearingSession
{
    public const UNSETTLED = 'Unsettled';

    public const AGREEMENT = 'Agreement';

    public const OUTCOMES = [self::UNSETTLED, self::AGREEMENT];

    /** KP Law: the parties may repudiate an amicable settlement within ten days. */
    private const REPUDIATION_DAYS = 10;

    public function __construct(private readonly HearingCalendar $calendar)
    {
    }

    /**
     * @param array{minutes: string, outcome: string, agreement?: ?string, complainant_present?: ?bool, respondent_present?: ?bool, attendance_notes?: ?string, started_at?: ?string, ended_at?: ?string} $data
     * @return array{hearing: Hearing, case: CaseFile, message: string}
     */
    public function record(Hearing $hearing, array $data): array
    {
        $case = $hearing->luponCase;
        $outcome = $data['outcome'];

        return DB::transaction(function () use ($hearing, $case, $data, $outcome) {
            /* The clock readings are hours on the sitting's OWN day. */
            $onTheDay = function (?string $timeStr) use ($hearing) {
                if (! $timeStr || ! $hearing->scheduled_at) {
                    return null;
                }
                $timePart = substr($timeStr, 0, 8);
                if (strlen($timePart) === 5) {
                    $timePart .= ':00';
                }
                return $hearing->scheduled_at->copy()->setTimeFromTimeString($timePart);
            };

            $hearing->update([
                'status' => 'Completed',
                'started_at' => $onTheDay($data['started_at'] ?? null) ?? $hearing->started_at,
                'ended_at' => $onTheDay($data['ended_at'] ?? null) ?? $hearing->ended_at,
                'proceedings_notes' => $data['minutes'],
                'outcome' => $outcome,
                'complainant_present' => $data['complainant_present'] ?? $hearing->complainant_present,
                'respondent_present' => $data['respondent_present'] ?? $hearing->respondent_present,
                'attendance_notes' => $data['attendance_notes'] ?? $hearing->attendance_notes,
                'recorded_by' => auth()->id(),
            ]);

            $message = $outcome === self::AGREEMENT
                ? $this->agreed($case, $hearing, (string) ($data['agreement'] ?? ''))
                : $this->unsettled($case, $hearing);

            return ['hearing' => $hearing->fresh(), 'case' => $case->fresh()->load('hearings'), 'message' => $message];
        });
    }

    /**
     * Records or updates minutes and session outcome for a hearing.
     * Works for both Scheduled (first-time) and Completed (editing past minutes) hearings.
     *
     * @param array{minutes: string, outcome: string, agreement?: ?string, complainant_present?: ?bool, respondent_present?: ?bool, attendance_notes?: ?string, started_at?: ?string, ended_at?: ?string} $data
     * @return array{hearing: Hearing, case: CaseFile, message: string}
     */
    public function recordOrUpdate(Hearing $hearing, array $data): array
    {
        if ($hearing->status === 'Scheduled') {
            return $this->record($hearing, $data);
        }

        $case = $hearing->luponCase;
        $outcome = $data['outcome'] ?? ($hearing->outcome ?: 'Unsettled');

        return DB::transaction(function () use ($hearing, $case, $data, $outcome) {
            $onTheDay = function (?string $timeStr) use ($hearing) {
                if (! $timeStr || ! $hearing->scheduled_at) {
                    return null;
                }
                $timePart = substr($timeStr, 0, 8);
                if (strlen($timePart) === 5) {
                    $timePart .= ':00';
                }
                return $hearing->scheduled_at->copy()->setTimeFromTimeString($timePart);
            };

            $hearing->update([
                'status' => 'Completed',
                'started_at' => $onTheDay($data['started_at'] ?? null) ?? $hearing->started_at,
                'ended_at' => $onTheDay($data['ended_at'] ?? null) ?? $hearing->ended_at,
                'proceedings_notes' => $data['minutes'] ?? ($data['proceedings_notes'] ?? $hearing->proceedings_notes),
                'outcome' => $outcome,
                'complainant_present' => $data['complainant_present'] ?? $hearing->complainant_present,
                'respondent_present' => $data['respondent_present'] ?? $hearing->respondent_present,
                'attendance_notes' => $data['attendance_notes'] ?? $hearing->attendance_notes,
                'recorded_by' => auth()->id(),
            ]);

            if ($outcome === self::AGREEMENT && ! empty($data['agreement'])) {
                $this->agreed($case, $hearing, (string) $data['agreement']);
            }

            return [
                'hearing' => $hearing->fresh(),
                'case' => $case ? $case->fresh()->load('hearings') : null,
                'message' => 'Minutes saved successfully.',
            ];
        });
    }

    /** The parties agreed: the terms become the settlement and the case closes. */
    private function agreed(CaseFile $case, Hearing $hearing, string $terms): string
    {
        /* The day of the sitting, not the day it was typed up: the ten days
           run from the agreement. */
        $agreedOn = ($hearing->scheduled_at ?? Carbon::now(ManilaTime::ZONE))->toDateString();

        $settlement = $case->settlement()->first();

        if ($settlement) {
            $settlement->update(['terms' => $terms, 'date_agreed' => $agreedOn]);
        } else {
            $case->settlement()->create([
                'settlement_type' => 'Amicable Settlement',
                'terms' => $terms,
                'date_agreed' => $agreedOn,
                'repudiation_deadline' => Carbon::parse($agreedOn)->addDays(self::REPUDIATION_DAYS)->toDateString(),
                'recorded_by' => auth()->id(),
            ]);
        }

        /* The agreement IS why the case closed, so the register carries
           it: a closed case with nothing beside it is one nobody can
           explain to a party who comes back asking. */
        $case->update([
            'current_stage' => 'Settled',
            'date_resolved' => $agreedOn,
            'closure_reason' => 'Settled at the sitting of ' . $agreedOn . ': ' . $terms,
        ]);

        $stood = $this->calendar->standDown($case, 'Stood down: the case settled on ' . $agreedOn . '.');

        return 'Agreement recorded — the case is settled and closed.'
            . ($stood > 0 ? " {$stood} remaining sitting(s) were stood down." : '')
            . ' Either side may repudiate within ' . self::REPUDIATION_DAYS . ' days.';
    }

    /**
     * Nothing agreed.
     *
     * While a sitting of the same kind is still ahead, the case stands where
     * it is and so does the calendar. When THIS was the last of the three,
     * the stage is spent and the case moves by itself:
     *
     *   the three Tuesdays  →  the case goes to the Lupon, which prints its
     *                          own summons and books three Thursdays
     *   the three Thursdays →  nothing more is booked. The Lupon may certify
     *                          it to file action, and the parties may still
     *                          settle up to the moment it does.
     */
    private function unsettled(CaseFile $case, Hearing $hearing): string
    {
        $type = $hearing->hearing_type;

        // Count completed hearings of this type on this case
        $completedCount = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Completed')
            ->count();

        if ($type === 'Mediation') {
            if ($completedCount < 3) {
                // Must complete 3 PB mediation attempts before moving to Lupon stage
                $next = $case->hearings()
                    ->where('hearing_type', 'Mediation')
                    ->where('status', 'Scheduled')
                    ->first();

                if (! $next) {
                    $prevDate = $hearing->scheduled_at ? $hearing->scheduled_at->copy() : Carbon::now(ManilaTime::ZONE);
                    $nextTuesday = $prevDate->copy()->addWeek();
                    $result = $this->calendar->getOrCreateHearing($case, 'Mediation', $nextTuesday, false);
                    $next = $result['hearing'];
                }

                $nextSeq = $completedCount + 1;
                $timeRange = $next->schedule_time_range ?: $next->scheduled_at->format('g:i A');
                $dayName = $next->scheduled_at->format('l, F j, Y');

                return "Recorded as unsettled (Punong Barangay Hearing #{$completedCount}). Punong Barangay Hearing #{$nextSeq} is scheduled for {$dayName} at {$timeRange}.";
            }

            // Exactly 3 Punong Barangay hearings completed unsettled! Move to Lupon stage
            $case->update(['current_stage' => 'For Lupon Summons']);

            return 'Recorded as unsettled. All 3 mediation hearings with the Punong Barangay are completed without settlement. '
                . 'The case has advanced to the Lupon conciliation stage (For Lupon Summons). '
                . 'The Lupon office may now print the summons to schedule the first Lupon hearing.';
        }

        // Lupon Conciliation stage
        if ($completedCount < 3) {
            $next = $case->hearings()
                ->where('hearing_type', 'Conciliation')
                ->where('status', 'Scheduled')
                ->first();

            if (! $next) {
                $prevDate = $hearing->scheduled_at ? $hearing->scheduled_at->copy() : Carbon::now(ManilaTime::ZONE);
                $nextThursday = $prevDate->copy()->addWeek();
                $result = $this->calendar->getOrCreateHearing($case, 'Conciliation', $nextThursday, false);
                $next = $result['hearing'];
            }

            $nextSeq = $completedCount + 1;
            $timeRange = $next->schedule_time_range ?: $next->scheduled_at->format('g:i A');
            $dayName = $next->scheduled_at->format('l, F j, Y');

            return "Recorded as unsettled (Lupon Hearing #{$completedCount}). Lupon Hearing #{$nextSeq} is scheduled for {$dayName} at {$timeRange}.";
        }

        // 3 Lupon conciliation hearings completed without settlement!
        $case->update(['current_stage' => 'CFA']);

        return 'Recorded as unsettled. All 3 conciliation hearings with the Lupon are completed without settlement. '
            . 'The case is now eligible for a Certificate to File Action (CFA).';
    }
}
