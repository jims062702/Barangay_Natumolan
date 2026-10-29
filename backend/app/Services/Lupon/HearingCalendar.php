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

    public const CLOSES_AT = 19;

    /**
     * Standard Daily Hearing Slots (8 slots for 8 cases per day: 08:00 to 17:00, lunch break 12:00-13:00)
     */
    public const DAILY_SLOTS = [
        ['start' => '08:00', 'end' => '09:00', 'label' => '08:00 AM'],
        ['start' => '09:00', 'end' => '10:00', 'label' => '09:00 AM'],
        ['start' => '10:00', 'end' => '11:00', 'label' => '10:00 AM'],
        ['start' => '11:00', 'end' => '12:00', 'label' => '11:00 AM'],
        ['start' => '13:00', 'end' => '14:00', 'label' => '01:00 PM'],
        ['start' => '14:00', 'end' => '15:00', 'label' => '02:00 PM'],
        ['start' => '15:00', 'end' => '16:00', 'label' => '03:00 PM'],
        ['start' => '16:00', 'end' => '17:00', 'label' => '04:00 PM'],
    ];

    /** Maximum allowed scheduled cases per hearing day (8 cases per Tuesday for PB, 8 per Thursday for Lupon) */
    public const MAX_DAILY_CASES = 8;

    /**
     * Ensures hearings are scheduled for the case at the given stage (up to 3 weekly hearings):
     * Punong Barangay (Tuesdays) or Lupon (Thursdays).
     * Strictly ONE hearing per case per week.
     * Enforces MAX_DAILY_CASES = 7 active cases per day.
     *
     * @return array{hearing: Hearing, hearings: Hearing[], reused: bool, message: string}
     */
    public function getOrCreateHearing(
        CaseFile $case,
        string $type,
        ?Carbon $after = null,
        bool $markSummonsPrinted = false
    ): array {
        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Scheduled')
            ->orderBy('scheduled_at')
            ->get();

        $reused = $existing->isNotEmpty();
        $hearings = $this->schedule($case, $type, $after, $markSummonsPrinted);
        $first = collect($hearings)->sortBy('scheduled_at')->first();

        $timeRange = $first->schedule_time_range ?: $first->scheduled_at->format('g:i A');
        $dayName = $first->scheduled_at->format('l, F j, Y');
        $label = $type === 'Mediation' ? 'Punong Barangay' : 'Lupon';

        return [
            'hearing' => $first,
            'hearings' => $hearings,
            'reused' => $reused,
            'message' => $reused
                ? "Existing {$type} hearing schedule used: {$dayName}."
                : "{$label} hearings scheduled starting {$dayName}.",
        ];
    }

    /**
     * Schedules the hearing sessions for the case (up to 3 weekly sessions).
     *
     * @return Hearing[] the sessions
     */
    public function schedule(
        CaseFile $case,
        string $type,
        ?Carbon $after = null,
        bool $summonsOnFirst = false
    ): array {
        // 1. If active scheduled hearings already exist, reuse them
        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Scheduled')
            ->orderBy('scheduled_at')
            ->get();

        if ($existing->isNotEmpty()) {
            if ($summonsOnFirst) {
                foreach ($existing as $h) {
                    if (! $h->summons_issued) {
                        $h->update([
                            'summons_issued' => true,
                            'summons_printed_at' => ManilaTime::now(),
                        ]);
                    }
                }
            }
            return $existing->all();
        }

        // 2. Stage eligibility check: Lupon Conciliation requires all 3 PB mediation sessions to be held/concluded
        if ($type === 'Conciliation') {
            if (! $case->isEligibleForLuponConciliation()) {
                throw new \InvalidArgumentException('A case must complete all 3 Punong Barangay mediation sessions before Lupon hearing can be scheduled.');
            }
        } elseif ($type === 'Mediation' && in_array($case->current_stage, ['For Lupon Summons', 'Conciliation', 'CFA', 'Settled'], true)) {
            throw new \InvalidArgumentException('Case has already moved past Punong Barangay stage.');
        }

        // 3. Check how many completed hearings exist for this stage
        $completedCount = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Completed')
            ->count();

        if ($completedCount >= self::SESSIONS) {
            throw new \InvalidArgumentException("Case has already completed all {$completedCount} {$type} hearings.");
        }

        $sessionsToSchedule = self::SESSIONS - $completedCount;
        $weekday = $type === 'Mediation' ? self::MEDIATION_DAY : self::CONCILIATION_DAY;

        if ($completedCount === 0) {
            if ($type === 'Conciliation') {
                $lastPbHearing = $case->hearings()
                    ->where('hearing_type', 'Mediation')
                    ->where('status', 'Completed')
                    ->latest('scheduled_at')
                    ->first();
                $from = $after ? $after->copy() : ($lastPbHearing ? $lastPbHearing->scheduled_at->copy() : ManilaTime::now());
            } else {
                $from = $after ? $after->copy() : Carbon::parse($case->date_filed ?: ManilaTime::today());
            }
            $firstDay = $this->firstDay($from, $weekday);
        } else {
            // For remaining hearings, must be strictly after previous completed hearing
            $lastCompleted = $case->hearings()
                ->where('hearing_type', $type)
                ->where('status', 'Completed')
                ->latest('scheduled_at')
                ->first();
            $from = $lastCompleted ? $lastCompleted->scheduled_at->copy()->addDay() : ($after ? $after->copy() : ManilaTime::now());
            $firstDay = $from->copy()->startOfDay()->next($weekday);
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($case, $type, $firstDay, $sessionsToSchedule, $summonsOnFirst) {
            $slots = $this->findBlockSlots($firstDay, $type, $sessionsToSchedule);
            $created = [];
            $now = ManilaTime::now();

            foreach ($slots as $slot) {
                $created[] = $case->hearings()->create([
                    'lupon_case_id' => $case->id,
                    'hearing_type' => $type,
                    'scheduled_at' => $slot,
                    'status' => 'Scheduled',
                    'summons_issued' => $summonsOnFirst,
                    'summons_printed_at' => $summonsOnFirst ? $now : null,
                    'recorded_by' => auth()->id(),
                ]);
            }

            if (in_array($case->current_stage, ['Filed', 'For Summons'], true) && $type === 'Mediation' && $summonsOnFirst) {
                $case->update(['current_stage' => 'Mediation']);
            } elseif ($case->current_stage === 'For Lupon Summons' && $type === 'Conciliation' && $summonsOnFirst) {
                $case->update(['current_stage' => 'Conciliation']);
            }

            return $created;
        });
    }

    /**
     * What printing the summons NOW would book — returns planned dates and hours for the sessions.
     *
     * @return Carbon[]
     */
    public function plan(CaseFile $case, string $type, ?Carbon $after = null): array
    {
        if ($type === 'Conciliation') {
            if (! $case->isEligibleForLuponConciliation()) {
                return [];
            }
        }

        $existing = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Scheduled')
            ->orderBy('scheduled_at')
            ->get();

        if ($existing->isNotEmpty()) {
            return $existing->pluck('scheduled_at')->all();
        }

        $weekday = $type === 'Mediation' ? self::MEDIATION_DAY : self::CONCILIATION_DAY;
        $completedCount = $case->hearings()
            ->where('hearing_type', $type)
            ->where('status', 'Completed')
            ->count();

        $sessionsToPlan = max(1, self::SESSIONS - $completedCount);

        if ($completedCount === 0) {
            if ($type === 'Conciliation') {
                $lastPbHearing = $case->hearings()
                    ->where('hearing_type', 'Mediation')
                    ->where('status', 'Completed')
                    ->latest('scheduled_at')
                    ->first();
                $from = $after ? $after->copy() : ($lastPbHearing ? $lastPbHearing->scheduled_at->copy() : ManilaTime::now());
            } else {
                $from = $after ? $after->copy() : Carbon::parse($case->date_filed ?: ManilaTime::today());
            }
            $firstDay = $this->firstDay($from, $weekday);
        } else {
            $lastCompleted = $case->hearings()
                ->where('hearing_type', $type)
                ->where('status', 'Completed')
                ->latest('scheduled_at')
                ->first();
            $from = $lastCompleted ? $lastCompleted->scheduled_at->copy()->addDay() : ($after ? $after->copy() : ManilaTime::now());
            $firstDay = $from->copy()->startOfDay()->next($weekday);
        }

        return $this->findBlockSlots($firstDay, $type, $sessionsToPlan);
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

        if ($weekday === self::CONCILIATION_DAY) {
            $thursdayThisWeek = $day->copy()->startOfWeek(Carbon::MONDAY)->addDays(3);
            if ($day->lt($thursdayThisWeek)) {
                return $thursdayThisWeek;
            }
        }

        return $day->next($weekday);
    }

    /**
     * The next free hour on that day.
     */
    public function slotOn(Carbon $day, string $type, ?int $excludeHearingId = null): Carbon
    {
        return $this->nextAvailableSlotOn($day, $type, $excludeHearingId);
    }

    /**
     * Finds the next available valid hearing slot on or after the given day for a single session.
     */
    public function nextAvailableSlotOn(Carbon $day, string $type, ?int $excludeHearingId = null): Carbon
    {
        $slots = $this->findBlockSlots($day, $type, 1, $excludeHearingId);
        return $slots[0];
    }

    /**
     * Finds available hearing slots across a contiguous multi-week block (e.g. 3 consecutive weeks).
     * Enforces MAX_DAILY_CASES = 7 active cases per day.
     * Searches standard DAILY_SLOTS in chronological order.
     * Evaluates all weeks in the block: if any week is full or collides, advances candidate start day.
     *
     * @return Carbon[]
     */
    public function findBlockSlots(Carbon $firstDay, string $type, int $sessionCount = self::SESSIONS, ?int $excludeHearingId = null): array
    {
        $candidateDay = $firstDay->copy()->startOfDay();

        for ($weekOffset = 0; $weekOffset < 52; $weekOffset++) {
            $blockFull = false;
            $weeksHearings = [];

            for ($s = 0; $s < $sessionCount; $s++) {
                $dayForSession = $candidateDay->copy()->addWeeks($s);
                $existing = Hearing::whereDate('scheduled_at', $dayForSession->toDateString())
                    ->where('hearing_type', $type)
                    ->where('status', 'Scheduled')
                    ->when($excludeHearingId, fn ($q) => $q->where('id', '!=', $excludeHearingId))
                    ->orderBy('scheduled_at', 'asc')
                    ->get();

                if ($existing->count() >= self::MAX_DAILY_CASES) {
                    $blockFull = true;
                    break;
                }

                $weeksHearings[$s] = $existing;
            }

            if ($blockFull) {
                $candidateDay->addWeek();
                continue;
            }

            foreach (self::DAILY_SLOTS as $slot) {
                [$sh, $sm] = explode(':', $slot['start']);

                $slotAvailable = true;

                for ($s = 0; $s < $sessionCount; $s++) {
                    $dayForSession = $candidateDay->copy()->addWeeks($s);
                    $slotStart = $dayForSession->copy()->setTime((int) $sh, (int) $sm, 0);

                    if ($slotStart->isPast()) {
                        $slotAvailable = false;
                        break;
                    }

                    foreach ($weeksHearings[$s] as $existing) {
                        $rawTime = $existing->scheduled_at instanceof Carbon
                            ? $existing->scheduled_at->format('Y-m-d H:i:s')
                            : Carbon::parse($existing->scheduled_at)->format('Y-m-d H:i:s');
                        $exStart = Carbon::parse($rawTime, ManilaTime::ZONE);

                        // Conflict check: taken if another hearing on the same day starts at the same hour or within 30 mins
                        if (abs($slotStart->diffInMinutes($exStart, false)) < 30) {
                            $slotAvailable = false;
                            break 2;
                        }
                    }
                }

                if ($slotAvailable) {
                    $slots = [];
                    for ($s = 0; $s < $sessionCount; $s++) {
                        $slots[] = $candidateDay->copy()->addWeeks($s)->setTime((int) $sh, (int) $sm, 0);
                    }
                    return $slots;
                }
            }

            $candidateDay->addWeek();
        }

        $slots = [];
        for ($s = 0; $s < $sessionCount; $s++) {
            $slots[] = $candidateDay->copy()->addWeeks($s)->setTime(self::OPENS_AT, 0, 0);
        }
        return $slots;
    }

    /**
     * Returns capacity statistics for a given day (e.g. 5/8 cases scheduled, is_full = false).
     *
     * @return array{date: string, count: int, max: int, is_full: bool}
     */
    public function getCapacity(string|Carbon $date, string $type): array
    {
        $dateStr = $date instanceof Carbon ? $date->toDateString() : substr((string) $date, 0, 10);
        $count = Hearing::whereDate('scheduled_at', $dateStr)
            ->where('hearing_type', $type)
            ->where('status', '!=', 'Cancelled')
            ->count();

        return [
            'date' => $dateStr,
            'count' => $count,
            'max' => self::MAX_DAILY_CASES,
            'is_full' => $count >= self::MAX_DAILY_CASES,
        ];
    }

    /**
     * Returns capacity statistics for all hearing days (Tuesdays or Thursdays) in a given month.
     *
     * @return array<string, array{date: string, count: int, max: int, is_full: bool}>
     */
    public function monthCapacities(string $yearMonth, string $type): array
    {
        $counts = Hearing::where('hearing_type', $type)
            ->where('status', '!=', 'Cancelled')
            ->whereRaw("DATE_FORMAT(scheduled_at, '%Y-%m') = ?", [$yearMonth])
            ->selectRaw('DATE(scheduled_at) as hearing_date, COUNT(*) as scheduled_count')
            ->groupBy('hearing_date')
            ->pluck('scheduled_count', 'hearing_date')
            ->toArray();

        $result = [];
        $weekday = $type === 'Mediation' ? self::MEDIATION_DAY : self::CONCILIATION_DAY;
        $start = Carbon::parse($yearMonth . '-01', ManilaTime::ZONE)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            if ($d->dayOfWeek === $weekday) {
                $dateStr = $d->toDateString();
                $c = (int) ($counts[$dateStr] ?? 0);
                $result[$dateStr] = [
                    'date' => $dateStr,
                    'count' => $c,
                    'max' => self::MAX_DAILY_CASES,
                    'is_full' => $c >= self::MAX_DAILY_CASES,
                ];
            }
        }

        return $result;
    }

    /**
     * When a sitting that starts then is EXPECTED to be over.
     */
    public static function endsAt(Carbon $start): Carbon
    {
        return $start->copy()->addHour();
    }

    /** Is this appointment past the hour the hall closes? */
    public static function pastClosing(Carbon $start): bool
    {
        return $start->hour >= self::CLOSES_AT;
    }

    /**
     * Stands down the sittings a case no longer needs.
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
