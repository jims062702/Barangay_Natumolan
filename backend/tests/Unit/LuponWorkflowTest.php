<?php

namespace Tests\Unit;

use App\Services\Lupon\HearingCalendar;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class LuponWorkflowTest extends TestCase
{
    public function test_standard_daily_slots_and_capacity(): void
    {
        $this->assertCount(8, HearingCalendar::DAILY_SLOTS);
        $this->assertEquals(8, HearingCalendar::MAX_DAILY_CASES);

        $slots = HearingCalendar::DAILY_SLOTS;

        // 8 slots: 1-hour intervals across working hours
        $this->assertEquals('08:00', $slots[0]['start']);
        $this->assertEquals('09:00', $slots[1]['start']);
        $this->assertEquals('10:00', $slots[2]['start']);
        $this->assertEquals('11:00', $slots[3]['start']);
        $this->assertEquals('13:00', $slots[4]['start']);
        $this->assertEquals('14:00', $slots[5]['start']);
        $this->assertEquals('15:00', $slots[6]['start']);
        $this->assertEquals('16:00', $slots[7]['start']);
    }

    public function test_collision_condition_logic(): void
    {
        // Existing hearing: 08:00
        $exStart = Carbon::parse('2026-10-15 08:00:00');

        // Candidate 1: Starts at 08:00 -> Collides!
        $cand1Start = Carbon::parse('2026-10-15 08:00:00');
        $this->assertTrue(abs($cand1Start->diffInMinutes($exStart, false)) < 30);

        // Candidate 2: Starts at 09:00 (Slot 2) -> MUST NOT collide!
        $cand2Start = Carbon::parse('2026-10-15 09:00:00');
        $this->assertFalse(abs($cand2Start->diffInMinutes($exStart, false)) < 30);

        // Candidate 3: Starts at 08:15 (within 30 mins) -> Collides!
        $cand3Start = Carbon::parse('2026-10-15 08:15:00');
        $this->assertTrue(abs($cand3Start->diffInMinutes($exStart, false)) < 30);
    }

    public function test_first_day_calculation(): void
    {
        $calendar = new HearingCalendar();

        // If summons printed Friday, Oct 2, 2026:
        // Mediation: Tuesday of following week -> Oct 6, 2026
        $friday = Carbon::parse('2026-10-02 14:00:00');
        $medDayFromFriday = $calendar->firstDay($friday, HearingCalendar::MEDIATION_DAY);
        $this->assertEquals('2026-10-06', $medDayFromFriday->toDateString());

        // If summons printed Monday, Oct 5, 2026:
        // Mediation: Tuesday of following week -> Oct 13, 2026
        $monday = Carbon::parse('2026-10-05 10:00:00');
        $medDayFromMonday = $calendar->firstDay($monday, HearingCalendar::MEDIATION_DAY);
        $this->assertEquals('2026-10-13', $medDayFromMonday->toDateString());

        // Same-week Thursday conciliation opportunity:
        // If 3rd PB hearing ends on Tuesday Oct 6, Lupon hearing starts on Thursday of the SAME week -> Oct 8, 2026!
        $tuesday = Carbon::parse('2026-10-06 10:00:00');
        $concDaySameWeek = $calendar->firstDay($tuesday, HearingCalendar::CONCILIATION_DAY);
        $this->assertEquals('2026-10-08', $concDaySameWeek->toDateString());

        // If today is Thursday Oct 8, next Thursday is Oct 15
        $thursday = Carbon::parse('2026-10-08 14:00:00');
        $concDayNextWeek = $calendar->firstDay($thursday, HearingCalendar::CONCILIATION_DAY);
        $this->assertEquals('2026-10-15', $concDayNextWeek->toDateString());
    }
}
