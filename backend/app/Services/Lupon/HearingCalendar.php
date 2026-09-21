<?php

namespace App\Services\Lupon;

use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * The three weeks of hearings a case gets, set out in advance.
 *
 * The barangay sits on fixed days: the Punong Barangay mediates on TUESDAYS
 * and the Lupon conciliates on THURSDAYS, each for three weeks. Those are not
 * dates somebody decides case by case — they are when the hall is open for
 * this — so the office should not have to book the next one every week.
 *
 * All three are created at once. A clerk who has to click "schedule the next
 * hearing" after every session is a clerk who, on a busy Tuesday, does not —
 * and the case then sits with no date on it and nothing to say it is waiting.
 *
 * WHAT HAPPENS WHEN IT SETTLES EARLY. The remaining sessions are cancelled,
 * not deleted: "cancelled because the case settled on the 14th" is a fact the
 * docket should be able to show, and a row that vanishes cannot say it.
 */
class HearingCalendar
{
    /** Punong Barangay mediation: Tuesdays. */
    public const MEDIATION_DAY = Carbon::TUESDAY;

    /** Lupon conciliation: Thursdays. */
    public const CONCILIATION_DAY = Carbon::THURSDAY;

    /** Three weeks of each, which is what the barangay allows. */
    public const SESSIONS = 3;

    /** What time the parties are told to come. */
    public const HOUR = 9;

    /**
     * Books the three sessions of one stage, if they are not booked already.
     *
     * Idempotent on purpose: it runs when the summons is issued and again
     * when mediation fails, and being called twice must not put six hearings
     * on one case. A stage that already has scheduled sessions is left as it
     * is and the existing ones are returned.
     *
     * @return Hearing[] the sessions, in date order
     */
    public function schedule(
        CaseFile $case,
        string $type,
        ?Carbon $after = null,
        bool $summonsOnFirst = false
    ): array {
        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->whereIn('status', ['Scheduled', 'Completed'])
            ->orderBy('scheduled_at')
            ->get();

        if ($existing->isNotEmpty()) {
            return $existing->all();
        }

        $weekday = $type === 'Mediation' ? self::MEDIATION_DAY : self::CONCILIATION_DAY;
        $from = $after ? $after->copy() : Carbon::now(ManilaTime::ZONE);

        $made = [];

        foreach ($this->dates($from, $weekday) as $index => $date) {
            $made[] = $case->hearings()->create([
                'hearing_type' => $type,
                'scheduled_at' => $date,
                'status' => 'Scheduled',
                /*
                 * Only the FIRST session carries the summons.
                 *
                 * One case, one summons: the respondent is called to answer
                 * the complaint, not to each sitting separately. Marking all
                 * three would have the office serving the same paper weekly.
                 */
                'summons_issued' => $index === 0 && $summonsOnFirst,
            ]);
        }

        return $made;
    }

    /**
     * The next three of a given weekday, at the hour the hall sits.
     *
     * "Next" excludes today even when today IS that weekday: a summons issued
     * on a Tuesday morning cannot call anybody to a hearing that same
     * morning, and a date already past is a date nobody attends.
     *
     * @return Carbon[]
     */
    public function dates(Carbon $from, int $weekday): array
    {
        /*
         * `next()` already means "strictly after today", which is both
         * halves of what is wanted: from a Monday it gives tomorrow, and
         * from a Tuesday it gives the Tuesday a week away rather than this
         * morning. Adding a day first skipped the immediate one entirely.
         */
        $first = $from->copy()->startOfDay()->next($weekday)->setTime(self::HOUR, 0);

        return array_map(
            fn (int $week) => $first->copy()->addWeeks($week),
            range(0, self::SESSIONS - 1)
        );
    }

    /**
     * Stands down the sittings a case no longer needs.
     *
     * Cancelled rather than removed — see the note at the top. Only future
     * ones: a session that was actually held is part of the record whatever
     * happened afterwards.
     */
    public function standDown(CaseFile $case, string $reason, ?string $type = null): int
    {
        return $case->hearings()
            ->where('status', 'Scheduled')
            ->when($type, fn ($query) => $query->where('hearing_type', $type))
            ->update([
                'status' => 'Cancelled',
                'outcome' => $reason,
            ]);
    }
}
