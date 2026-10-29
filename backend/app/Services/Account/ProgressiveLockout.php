<?php

namespace App\Services\Account;

use Illuminate\Support\Facades\Cache;

/**
 * Progressive account lockout for failed login attempts and OTP activations.
 *
 * Ladder progression:
 * - Tier 0: Up to 5 failed attempts allowed before triggering lockout.
 * - Tier 1: 1st lockout lasts 15 minutes (900 seconds).
 * - Tier 2: If a failed attempt occurs after Tier 1 expires, lockout lasts 1 hour (3,600 seconds).
 * - Tier 3: If a failed attempt occurs after Tier 2 expires, lockout lasts 24 hours (86,400 seconds).
 * - Any subsequent failure after Tier 3 expires maintains the 24-hour lockout.
 *
 * Success (correct password or correct OTP) completely clears the lockout state and tier.
 */
class ProgressiveLockout
{
    public const ACTION_LOGIN = 'login';
    public const ACTION_ACTIVATION_OTP = 'activation-otp';
    public const ACTION_FORGOT_PASSWORD = 'forgot-password';

    /** Lockout durations in seconds: 15 minutes, 1 hour, 24 hours. */
    public const TIER_DURATIONS = [
        1 => 15 * 60,       // 15 minutes = 900s
        2 => 60 * 60,       // 1 hour = 3,600s
        3 => 24 * 60 * 60,  // 24 hours = 86,400s
    ];

    public const MAX_INITIAL_ATTEMPTS = 5;

    /**
     * Check if an account is currently locked out for the given action.
     * Returns the number of seconds remaining, or null if not locked.
     */
    public static function check(string $action, string $email): ?int
    {
        $key = self::cacheKey($action, $email);
        $state = Cache::get($key);

        if (!$state || !is_array($state) || empty($state['locked_until'])) {
            return null;
        }

        $now = time();
        if ($state['locked_until'] > $now) {
            return (int) ($state['locked_until'] - $now);
        }

        return null;
    }

    /**
     * Record a failed attempt for an account action.
     *
     * @return array{
     *     locked: bool,
     *     seconds: int,
     *     attempts_left: int,
     *     tier: int
     * }
     */
    public static function recordFailure(
        string $action,
        string $email,
        int $maxAttempts = self::MAX_INITIAL_ATTEMPTS
    ): array {
        $key = self::cacheKey($action, $email);
        $state = Cache::get($key, [
            'attempts' => 0,
            'tier' => 0,
            'locked_until' => null,
        ]);

        if (!is_array($state)) {
            $state = [
                'attempts' => 0,
                'tier' => 0,
                'locked_until' => null,
            ];
        }

        $now = time();

        // If already actively locked, return remaining seconds
        if (!empty($state['locked_until']) && $state['locked_until'] > $now) {
            $remaining = (int) ($state['locked_until'] - $now);
            return [
                'locked' => true,
                'seconds' => $remaining,
                'attempts_left' => 0,
                'tier' => (int) ($state['tier'] ?? 1),
            ];
        }

        $currentTier = (int) ($state['tier'] ?? 0);
        $attempts = (int) ($state['attempts'] ?? 0) + 1;

        // 5 requests per tier before triggering or escalating lockout
        if ($attempts >= $maxAttempts) {
            $nextTier = min(3, max(1, $currentTier + 1));
            $duration = self::TIER_DURATIONS[$nextTier];
            $lockedUntil = $now + $duration;

            $newState = [
                'attempts' => 0,
                'tier' => $nextTier,
                'locked_until' => $lockedUntil,
            ];

            // Retain state in cache for duration + 48 hours so the progressive tier is remembered
            Cache::put($key, $newState, now()->addSeconds($duration + 48 * 3600));

            return [
                'locked' => true,
                'seconds' => $duration,
                'attempts_left' => 0,
                'tier' => $nextTier,
            ];
        }

        // Not locked yet: record attempt in current tier
        $newState = [
            'attempts' => $attempts,
            'tier' => $currentTier,
            'locked_until' => null,
        ];

        // Failures decay after 1 hour of inactivity if no lockout was triggered
        Cache::put($key, $newState, now()->addHour());

        return [
            'locked' => false,
            'seconds' => 0,
            'attempts_left' => max(0, $maxAttempts - $attempts),
            'tier' => $currentTier,
        ];
    }

    /**
     * Record a successful attempt. Clears all lockout states and tiers for this action & email.
     */
    public static function recordSuccess(string $action, string $email): void
    {
        Cache::forget(self::cacheKey($action, $email));
    }

    /**
     * Format remaining seconds into a clear human-readable string.
     * Examples:
     * - 900s => "15 minutes"
     * - 60s => "1 minute"
     * - 3600s => "1 hour"
     * - 7200s => "2 hours"
     * - 86400s => "24 hours"
     */
    public static function formatRemaining(int $seconds): string
    {
        $seconds = max(1, $seconds);

        if ($seconds < 3600) {
            $minutes = max(1, (int) ceil($seconds / 60));
            return $minutes . ($minutes === 1 ? ' minute' : ' minutes');
        }

        $hours = max(1, (int) ceil($seconds / 3600));
        return $hours . ($hours === 1 ? ' hour' : ' hours');
    }

    /**
     * Cache key helper for isolation and clean hashing.
     */
    public static function cacheKey(string $action, string $email): string
    {
        $normalized = strtolower(trim($email));
        return 'progressive_lockout:' . $action . ':' . sha1($normalized);
    }
}

