<?php

namespace Tests\Unit;

use App\Services\Lupon\HearingCalendar;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class LuponWorkflowTest extends TestCase
{
    public function test_standard_daily_slots_and_capacity(): void
    {
        $this->assertCount(7, HearingCalendar::DAILY_SLOTS);
        $this->assertEquals(7, HearingCalendar::MAX_DAILY_CASES);
        $this->assertEquals(120, HearingCalendar::DURATION_MINUTES);
        $this->assertEquals(15, HearingCalendar::BUFFER_MINUTES);

        $slots = HearingCalendar::DAILY_SLOTS;

        // 7 slots: 2 hours each with 15-minute buffers
        $this->assertEquals('08:00', $slots[0]['start']);
        $this->assertEquals('10:00', $slots[0]['end']);

        $this->assertEquals('10:15', $slots[1]['start']);
        $this->assertEquals('12:15', $slots[1]['end']);

        $this->assertEquals('12:30', $slots[2]['start']);
        $this->assertEquals('14:30', $slots[2]['end']);

        $this->assertEquals('14:45', $slots[3]['start']);
        $this->assertEquals('16:45', $slots[3]['end']);

        $this->assertEquals('17:00', $slots[4]['start']);
        $this->assertEquals('19:00', $slots[4]['end']);

        $this->assertEquals('19:15', $slots[5]['start']);
        $this->assertEquals('21:15', $slots[5]['end']);

        $this->assertEquals('21:30', $slots[6]['start']);
        $this->assertEquals('23:30', $slots[6]['end']);
    }

    public function test_overlap_condition_logic(): void
    {
        // Existing hearing: 08:00 - 10:00, buffer until 10:15
        $exStart = Carbon::parse('2026-10-15 08:00:00');
        $exEnd = Carbon::parse('2026-10-15 10:00:00');
        $exBufferEnd = Carbon::parse('2026-10-15 10:15:00');

        // Candidate 1: Starts at 08:00 -> Collides!
        $cand1Start = Carbon::parse('2026-10-15 08:00:00');
        $cand1BufferEnd = Carbon::parse('2026-10-15 10:15:00');
        $this->assertTrue($cand1Start->lt($exBufferEnd) && $exStart->lt($cand1BufferEnd));

        // Candidate 2: Starts at 10:15 (Slot 2) -> MUST NOT collide!
        $cand2Start = Carbon::parse('2026-10-15 10:15:00');
        $cand2BufferEnd = Carbon::parse('2026-10-15 12:30:00');
        $this->assertFalse($cand2Start->lt($exBufferEnd) && $exStart->lt($cand2BufferEnd));

        // Candidate 3: Starts at 10:00 (during 15-min buffer) -> MUST collide!
        $cand3Start = Carbon::parse('2026-10-15 10:00:00');
        $cand3BufferEnd = Carbon::parse('2026-10-15 12:15:00');
        $this->assertTrue($cand3Start->lt($exBufferEnd) && $exStart->lt($cand3BufferEnd));
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
