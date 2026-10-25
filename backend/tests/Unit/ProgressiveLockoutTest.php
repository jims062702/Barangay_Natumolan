<?php

namespace Tests\Unit;

use App\Services\Account\ProgressiveLockout;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ProgressiveLockoutTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_initial_attempts_and_tier_1_lockout(): void
    {
        $email = 'resident.test@natumolan.gov.ph';
        $action = ProgressiveLockout::ACTION_LOGIN;

        // Attempts 1 through 4 should not lock
        for ($i = 1; $i <= 4; $i++) {
            $result = ProgressiveLockout::recordFailure($action, $email, 5);
            $this->assertFalse($result['locked']);
            $this->assertEquals(5 - $i, $result['attempts_left']);
            $this->assertEquals(0, $result['tier']);
            $this->assertNull(ProgressiveLockout::check($action, $email));
        }

        // Attempt 5 triggers Tier 1 (15 minutes = 900s)
        $result = ProgressiveLockout::recordFailure($action, $email, 5);
        $this->assertTrue($result['locked']);
        $this->assertEquals(1, $result['tier']);
        $this->assertEquals(900, $result['seconds']);

        $remaining = ProgressiveLockout::check($action, $email);
        $this->assertNotNull($remaining);
        $this->assertGreaterThan(890, $remaining);
        $this->assertLessThanOrEqual(900, $remaining);
        $this->assertEquals('15 minutes', ProgressiveLockout::formatRemaining($remaining));
    }

    public function test_escalation_to_tier_2_and_tier_3(): void
    {
        $email = 'resident.otp@natumolan.gov.ph';
        $action = ProgressiveLockout::ACTION_ACTIVATION_OTP;

        // Reach Tier 1
        for ($i = 1; $i <= 5; $i++) {
            ProgressiveLockout::recordFailure($action, $email, 5);
        }

        // Simulate expiration of Tier 1 by adjusting locked_until in cache
        $key = ProgressiveLockout::cacheKey($action, $email);
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1; // Expired
        Cache::put($key, $state, 3600);

        $this->assertNull(ProgressiveLockout::check($action, $email));

        // 1 wrong attempt after Tier 1 expires escalates immediately to Tier 2 (1 hour = 3600s)
        $tier2Result = ProgressiveLockout::recordFailure($action, $email, 5);
        $this->assertTrue($tier2Result['locked']);
        $this->assertEquals(2, $tier2Result['tier']);
        $this->assertEquals(3600, $tier2Result['seconds']);
        $this->assertEquals('1 hour', ProgressiveLockout::formatRemaining($tier2Result['seconds']));

        // Simulate expiration of Tier 2
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1; // Expired
        Cache::put($key, $state, 3600);

        $this->assertNull(ProgressiveLockout::check($action, $email));

        // 1 wrong attempt after Tier 2 expires escalates immediately to Tier 3 (24 hours = 86400s)
        $tier3Result = ProgressiveLockout::recordFailure($action, $email, 5);
        $this->assertTrue($tier3Result['locked']);
        $this->assertEquals(3, $tier3Result['tier']);
        $this->assertEquals(86400, $tier3Result['seconds']);
        $this->assertEquals('24 hours', ProgressiveLockout::formatRemaining($tier3Result['seconds']));

        // Simulate expiration of Tier 3
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1; // Expired
        Cache::put($key, $state, 3600);

        // Next wrong attempt stays at Tier 3 (24 hours)
        $subsequentResult = ProgressiveLockout::recordFailure($action, $email, 5);
        $this->assertTrue($subsequentResult['locked']);
        $this->assertEquals(3, $subsequentResult['tier']);
        $this->assertEquals(86400, $subsequentResult['seconds']);
    }

    public function test_record_success_resets_all_lockout_state(): void
    {
        $email = 'resident.success@natumolan.gov.ph';
        $action = ProgressiveLockout::ACTION_LOGIN;

        // Reach Tier 1
        for ($i = 1; $i <= 5; $i++) {
            ProgressiveLockout::recordFailure($action, $email, 5);
        }
        $this->assertNotNull(ProgressiveLockout::check($action, $email));

        // Success resets completely
        ProgressiveLockout::recordSuccess($action, $email);
        $this->assertNull(ProgressiveLockout::check($action, $email));

        // A new failure starts cleanly back at Tier 0 (attempt 1)
        $fresh = ProgressiveLockout::recordFailure($action, $email, 5);
        $this->assertFalse($fresh['locked']);
        $this->assertEquals(0, $fresh['tier']);
        $this->assertEquals(4, $fresh['attempts_left']);
    }

    public function test_format_remaining_boundaries(): void
    {
        $this->assertEquals('1 minute', ProgressiveLockout::formatRemaining(1));
        $this->assertEquals('1 minute', ProgressiveLockout::formatRemaining(60));
        $this->assertEquals('2 minutes', ProgressiveLockout::formatRemaining(61));
        $this->assertEquals('15 minutes', ProgressiveLockout::formatRemaining(900));
        $this->assertEquals('59 minutes', ProgressiveLockout::formatRemaining(3540));
        $this->assertEquals('1 hour', ProgressiveLockout::formatRemaining(3600));
        $this->assertEquals('2 hours', ProgressiveLockout::formatRemaining(7200));
        $this->assertEquals('24 hours', ProgressiveLockout::formatRemaining(86400));
    }
}

