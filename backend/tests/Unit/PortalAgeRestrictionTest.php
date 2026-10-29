<?php

namespace Tests\Unit;

use App\Models\Resident\Resident;
use App\Services\Account\PortalAccount;
use Carbon\Carbon;
use Tests\TestCase;

class PortalAgeRestrictionTest extends TestCase
{
    public function test_age_automatically_increments_on_birthday(): void
    {
        // Resident born on October 25, 2008
        $birthdate = Carbon::parse('2008-10-25');
        $resident = new Resident(['birthdate' => $birthdate]);

        // Day before their 18th birthday
        Carbon::setTestNow(Carbon::parse('2026-10-24 23:59:59'));
        $this->assertEquals(17, $resident->birthdate->age);
        $this->assertTrue($resident->isMinor());

        // On their 18th birthday
        Carbon::setTestNow(Carbon::parse('2026-10-25 00:00:00'));
        $this->assertEquals(18, $resident->birthdate->age);
        $this->assertFalse($resident->isMinor());

        Carbon::setTestNow();
    }

    public function test_portal_account_provision_blocks_minors(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        // Minor resident (17 years old)
        $minor = new Resident([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'birthdate' => Carbon::parse('2009-01-01'),
            'email' => 'juan.minor@example.com',
            'is_active' => true,
        ]);

        $result = PortalAccount::provision($minor);
        $this->assertFalse($result['created']);
        $this->assertStringContainsString('18 and above', $result['reason']);

        // Adult resident (18 years old)
        $adult = new Resident([
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'birthdate' => Carbon::parse('2008-10-25'),
            'email' => 'maria.adult@example.com',
            'is_active' => true,
        ]);

        $this->assertEquals(18, $adult->birthdate->age);
        $this->assertFalse($adult->isMinor());

        Carbon::setTestNow();
    }

    public function test_age_demographic_classification_updates_automatically(): void
    {
        $resident = new Resident(['birthdate' => Carbon::parse('2011-10-25')]);

        Carbon::setTestNow(Carbon::parse('2026-10-24'));
        $this->assertEquals(14, $resident->birthdate->age);
        $this->assertEquals('Child', $resident->primaryAgeClassification());

        Carbon::setTestNow(Carbon::parse('2026-10-25'));
        $this->assertEquals(15, $resident->birthdate->age);
        $this->assertEquals('Youth', $resident->primaryAgeClassification());

        Carbon::setTestNow();
    }
}
