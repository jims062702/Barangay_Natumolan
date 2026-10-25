<?php

namespace Tests\Unit;

use App\Models\Account\User;
use App\Services\Account\ProgressiveLockout;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthLockoutTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_login_progressive_lockout_ladder(): void
    {
        $email = 'resident.login@example.com';

        // 1-4 wrong attempts: not locked
        for ($i = 1; $i <= 4; $i++) {
            $result = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_LOGIN, $email, 5);
            $this->assertFalse($result['locked']);
            $this->assertEquals(5 - $i, $result['attempts_left']);
        }

        // 5th wrong attempt: triggers 15-minute lock
        $tier1 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_LOGIN, $email, 5);
        $this->assertTrue($tier1['locked']);
        $this->assertEquals(1, $tier1['tier']);
        $this->assertEquals(900, $tier1['seconds']);
        $this->assertEquals('15 minutes', ProgressiveLockout::formatRemaining($tier1['seconds']));

        // Check is active
        $this->assertNotNull(ProgressiveLockout::check(ProgressiveLockout::ACTION_LOGIN, $email));

        // Expire Tier 1
        $key = ProgressiveLockout::cacheKey(ProgressiveLockout::ACTION_LOGIN, $email);
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1;
        Cache::put($key, $state, 3600);

        // Next failure triggers 1-hour lock
        $tier2 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_LOGIN, $email, 5);
        $this->assertTrue($tier2['locked']);
        $this->assertEquals(2, $tier2['tier']);
        $this->assertEquals(3600, $tier2['seconds']);
        $this->assertEquals('1 hour', ProgressiveLockout::formatRemaining($tier2['seconds']));

        // Expire Tier 2
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1;
        Cache::put($key, $state, 3600);

        // Next failure triggers 24-hour lock
        $tier3 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_LOGIN, $email, 5);
        $this->assertTrue($tier3['locked']);
        $this->assertEquals(3, $tier3['tier']);
        $this->assertEquals(86400, $tier3['seconds']);
        $this->assertEquals('24 hours', ProgressiveLockout::formatRemaining($tier3['seconds']));

        // Expire Tier 3
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1;
        Cache::put($key, $state, 3600);

        // Next failure stays at 24-hour lock
        $subsequent = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_LOGIN, $email, 5);
        $this->assertTrue($subsequent['locked']);
        $this->assertEquals(3, $subsequent['tier']);
        $this->assertEquals(86400, $subsequent['seconds']);

        // Success clears all
        ProgressiveLockout::recordSuccess(ProgressiveLockout::ACTION_LOGIN, $email);
        $this->assertNull(ProgressiveLockout::check(ProgressiveLockout::ACTION_LOGIN, $email));
    }

    public function test_activation_otp_progressive_lockout_ladder(): void
    {
        $email = 'resident.activation@example.com';

        // 1-4 wrong attempts
        for ($i = 1; $i <= 4; $i++) {
            $result = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email, 5);
            $this->assertFalse($result['locked']);
            $this->assertEquals(5 - $i, $result['attempts_left']);
        }

        // 5th wrong attempt triggers 15 minutes
        $tier1 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email, 5);
        $this->assertTrue($tier1['locked']);
        $this->assertEquals(1, $tier1['tier']);
        $this->assertEquals(900, $tier1['seconds']);
        $this->assertEquals('15 minutes', ProgressiveLockout::formatRemaining($tier1['seconds']));

        // Expire Tier 1
        $key = ProgressiveLockout::cacheKey(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email);
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1;
        Cache::put($key, $state, 3600);

        // Next wrong OTP triggers 1 hour
        $tier2 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email, 5);
        $this->assertTrue($tier2['locked']);
        $this->assertEquals(2, $tier2['tier']);
        $this->assertEquals(3600, $tier2['seconds']);
        $this->assertEquals('1 hour', ProgressiveLockout::formatRemaining($tier2['seconds']));

        // Expire Tier 2
        $state = Cache::get($key);
        $state['locked_until'] = time() - 1;
        Cache::put($key, $state, 3600);

        // Next wrong OTP triggers 24 hours
        $tier3 = ProgressiveLockout::recordFailure(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email, 5);
        $this->assertTrue($tier3['locked']);
        $this->assertEquals(3, $tier3['tier']);
        $this->assertEquals(86400, $tier3['seconds']);
        $this->assertEquals('24 hours', ProgressiveLockout::formatRemaining($tier3['seconds']));

        // Success clears all
        ProgressiveLockout::recordSuccess(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email);
        $this->assertNull(ProgressiveLockout::check(ProgressiveLockout::ACTION_ACTIVATION_OTP, $email));
    }
}

