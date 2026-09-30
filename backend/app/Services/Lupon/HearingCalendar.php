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

    /**
     * THE DAY IS CUT INTO SLOTS, because the hall holds one sitting at a
     * time.
     *
     * Every hearing used to be booked at 9:00 AM. Four cases on one Tuesday
     * meant four families in the corridor at nine o'clock, three of them
     * waiting hours for a hearing the paper in their hand said was at nine
     * — and nothing on the summons, or in the office, said otherwise.
     *
     *   the hall opens          8:00 AM
     *   a sitting is allowed    1 hour 30 minutes
     *   then the room clears    15 minutes
     *
     * so the sittings begin 8:00, 9:45, 11:30, 1:15, 3:00, 4:45.
     *
     * NO CASE IS PUSHED INTO ANOTHER WEEK TO MAKE THE DAY FIT. Six slots
     * fill the working day and the hall can be asked to hear ten; a
     * seventh case used to roll to the same weekday a week later, which
     * moved a party's hearing by seven days to tidy a calendar. The
     * eleventh case keeps its Tuesday, is given the next slot in the
     * arithmetic, and is FLAGGED as past closing so the office moves it
     * to an hour that suits them.
     *
     * The ninety minutes are a default for laying the day out, never a
     * deadline. Nothing here ends, cancels or completes a sitting when
     * they expire.
     */
    public const OPENS_AT = 8;

    public const CLOSES_AT = 17;

    public const MINUTES_PER_SITTING = 90;

    public const MINUTES_BETWEEN = 15;

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
                /* Its own hour on that day, after whatever is already
                   booked — see slotOn(). */
                'scheduled_at' => $this->slotOn($date, $type),
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
     * What printing the summons NOW would book — the same days and hours
     * schedule() would, without booking anything.
     *
     * The papers are printed from this, and the sittings are booked only
     * once the office says the papers came out (SummonsController::issue,
     * which checks the first sitting is still the one printed). A stage that
     * already has its sittings answers with those.
     *
     * @return Carbon[] in date order
     */
    public function plan(CaseFile $case, string $type, ?Carbon $after = null): array
    {
        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->whereIn('status', ['Scheduled', 'Completed'])
            ->orderBy('scheduled_at')
            ->get();

        if ($existing->isNotEmpty()) {
            return $existing->map(fn (Hearing $h) => $h->scheduled_at->copy())->all();
        }

        $weekday = $type === 'Mediation' ? self::MEDIATION_DAY : self::CONCILIATION_DAY;

        return array_map(
            fn (Carbon $date) => $this->slotOn($date, $type),
            $this->dates($after ? $after->copy() : Carbon::now(ManilaTime::ZONE), $weekday)
        );
    }

    /**
     * The three sitting days, a week apart.
     *
     * @return Carbon[]
     */
    public function dates(Carbon $from, int $weekday): array
    {
        $first = $this->firstDay($from, $weekday);

        return array_map(
            fn (int $week) => $first->copy()->addWeeks($week),
            range(0, self::SESSIONS - 1)
        );
    }

    /**
     * The first sitting's day, counted from the day the summons is printed.
     *
     * THE PUNONG BARANGAY'S (Tuesdays): the Tuesday of the FOLLOWING week —
     * the office's rule (2026-09-29). Printed on Friday, October 2, 2026,
     * the first hearing is Tuesday, October 6; printed on Monday, October 5,
     * it is Tuesday, October 13, not the next morning — a summons handed
     * over one day before the hearing gives the respondent no time to come.
     * (Weeks run Monday to Sunday.)
     *
     * THE LUPON'S (Thursdays): the next Thursday after the day of printing,
     * as it always was — "next" excludes today even when today is Thursday.
     */
    public function firstDay(Carbon $from, int $weekday): Carbon
    {
        $day = $from->copy()->startOfDay();

        if ($weekday === self::MEDIATION_DAY) {
            return $day->startOfWeek(Carbon::MONDAY)->addWeek()->addDays(($weekday - Carbon::MONDAY + 7) % 7);
        }

        return $day->next($weekday);
    }

    /**
     * The next free hour on that day. Always THAT day.
     *
     * The hall holds one sitting at a time, so the day is read before a
     * sitting is put on it: whatever is already booked decides which slot
     * this one gets. Past closing the arithmetic simply carries on — the
     * office is told (see `pastClosing`) and moves the start time to an
     * hour that suits them, which is a smaller thing to ask than moving a
     * family's hearing to another week.
     *
     * Counted per TYPE: the Punong Barangay sits on Tuesdays and the Lupon
     * on Thursdays, so they never share a day — but if a special sitting
     * ever put them on one, they are two different rooms and two different
     * queues, and one must not push the other down the clock.
     */
    public function slotOn(Carbon $day, string $type): Carbon
    {
        $taken = Hearing::whereDate('scheduled_at', $day->toDateString())
            ->where('hearing_type', $type)
            ->whereIn('status', ['Scheduled', 'Completed'])
            ->count();

        return $day->copy()->startOfDay()->setTime(self::OPENS_AT, 0)
            ->addMinutes($taken * (self::MINUTES_PER_SITTING + self::MINUTES_BETWEEN));
    }

    /**
     * When a sitting that starts then is EXPECTED to be over.
     *
     * Expected, not required. A hearing may run past it and nothing in the
     * system stops it: the parties are in the room and the dispute takes
     * what it takes.
     */
    public static function endsAt(Carbon $start): Carbon
    {
        return $start->copy()->addMinutes(self::MINUTES_PER_SITTING);
    }

    /** Is this appointment past the hour the hall closes? */
    public static function pastClosing(Carbon $start): bool
    {
        return self::endsAt($start)->hour >= self::CLOSES_AT
            || self::endsAt($start)->day !== $start->day;
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
