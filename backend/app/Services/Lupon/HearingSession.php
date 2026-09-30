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
     * @param array{minutes: string, outcome: string, agreement?: ?string, complainant_present?: ?bool, respondent_present?: ?bool, started_at?: ?string, ended_at?: ?string} $data
     * @return array{hearing: Hearing, case: CaseFile, message: string}
     */
    public function record(Hearing $hearing, array $data): array
    {
        $case = $hearing->luponCase;
        $outcome = $data['outcome'];

        return DB::transaction(function () use ($hearing, $case, $data, $outcome) {
            /* The clock readings are hours on the sitting's OWN day. */
            $onTheDay = fn (?string $hhmm) => $hhmm && $hearing->scheduled_at
                ? $hearing->scheduled_at->copy()->setTimeFromTimeString($hhmm . ':00')
                : null;

            $hearing->update([
                'status' => 'Completed',
                'started_at' => $onTheDay($data['started_at'] ?? null) ?? $hearing->started_at,
                'ended_at' => $onTheDay($data['ended_at'] ?? null) ?? $hearing->ended_at,
                'proceedings_notes' => $data['minutes'],
                'outcome' => $outcome,
                'complainant_present' => $data['complainant_present'] ?? $hearing->complainant_present,
                'respondent_present' => $data['respondent_present'] ?? $hearing->respondent_present,
                'recorded_by' => auth()->id(),
            ]);

            $message = $outcome === self::AGREEMENT
                ? $this->agreed($case, $hearing, (string) ($data['agreement'] ?? ''))
                : $this->unsettled($case, $hearing);

            return ['hearing' => $hearing->fresh(), 'case' => $case->fresh()->load('hearings'), 'message' => $message];
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

        $next = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Scheduled')
            ->orderBy('scheduled_at')
            ->first();

        if ($next) {
            return 'Recorded as unsettled. The next sitting is on '
                . $next->scheduled_at->format('F j, Y g:i A') . '.';
        }

        if ($type === 'Mediation') {
            $case->update(['current_stage' => 'For Lupon Summons']);

            return 'Recorded as unsettled. The three sittings with the Punong Barangay are spent, '
                . 'so the case has gone to the Lupon — they print the summons and the notice of '
                . 'hearing, and that books three Thursdays.';
        }

        return 'Recorded as unsettled. The three sittings with the Lupon are spent; '
            . 'the Lupon may now certify the case to file action.';
    }
}
