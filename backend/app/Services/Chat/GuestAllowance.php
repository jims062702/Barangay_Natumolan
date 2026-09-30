<?php

namespace App\Services\Chat;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * How many messages somebody NOT signed in may send the chatbot in a day —
 * counted here, per DEVICE, by the server. The office asked for ten a day
 * (2026-09-28), each device its own ten (2026-09-29).
 *
 * WHY A DEVICE AND NOT AN ADDRESS. It was counted per internet address, and
 * everybody behind one router — a household, a shop, a school on one Wi-Fi —
 * shared a single ten: one person's questions used up everybody else's. So
 * the first message from a device is given a DEVICE ID (a random token,
 * signed with the app key so it cannot be made up), the widget keeps it in
 * that browser, and the ten are that device's.
 *
 * WHAT A DEVICE CANNOT BE, without signing in: the same device across two
 * browsers, a private window, or cleared site data — the server has no way
 * to know those are one phone short of fingerprinting it, which the barangay
 * does not do. So a fresh device ID is itself limited, per network: this
 * many new devices a day from one internet address
 * (barangay.chat.guest_new_devices_per_network). A household's phones get
 * their ten each; clearing the browser over and over to start again runs
 * out.
 *
 * WHAT COUNTS: every message the chatbot deals with — a question it
 * answered, one it did not understand, and one that is plainly not words
 * (keyboard mashing, "?????"). Spam uses up the day like anything else.
 * WHAT DOES NOT: a message the widget refused before asking anybody (too
 * fast, the same question again), and one that could not be answered
 * because the chatbot itself was unreachable — that is the barangay's
 * fault, not the person's, and the widget hands the message back.
 *
 * THE DAY runs from the first message: a guest who starts at 3 PM chats
 * again at 3 PM tomorrow.
 *
 * Nothing that names anybody is written down: the counters are named by
 * keyed hashes of the device ID and of the address, so the cache holds
 * numbers and times, not who sent them. Signed in as a resident, nobody is
 * counted at all.
 */
final class GuestAllowance
{
    /** How long a hand-back stays good for the message it was issued for. */
    private const RECEIPT_SECONDS = 600;

    public static function limit(): int
    {
        return max(1, (int) config('barangay.chat.guest_daily_limit', 10));
    }

    /** New device IDs one internet address may be given in a day. */
    public static function newDevicesPerNetwork(): int
    {
        return max(1, (int) config('barangay.chat.guest_new_devices_per_network', 30));
    }

    private static function windowSeconds(): int
    {
        return max(1, (int) config('barangay.chat.guest_window_hours', 24)) * 3600;
    }

    private static function hmac(string $what): string
    {
        return hash_hmac('sha256', $what, (string) config('app.key'));
    }

    private static function key(string $device): string
    {
        return 'guest-chat-device:' . self::hmac('device|' . $device);
    }

    private static function networkKey(string $address): string
    {
        return 'guest-chat-network:' . self::hmac('network|' . $address);
    }

    /**
     * The device a token names — or null for none, or one that was made up
     * (its signature does not match).
     */
    public static function deviceFrom(?string $token): ?string
    {
        if (! is_string($token) || ! preg_match('/^([A-Za-z0-9]{32})\.([a-f0-9]{24})$/', $token, $m)) {
            return null;
        }

        return hash_equals(substr(self::hmac('token|' . $m[1]), 0, 24), $m[2]) ? $m[1] : null;
    }

    private static function tokenFor(string $device): string
    {
        return $device . '.' . substr(self::hmac('token|' . $device), 0, 24);
    }

    /** @return array{used: int, since: int} — a day that has run out reads as a new one. */
    private static function read(string $key): array
    {
        $state = Cache::get($key);
        $used = (int) ($state['used'] ?? 0);
        $since = (int) ($state['since'] ?? 0);

        if (! $since || $since + self::windowSeconds() <= now()->timestamp) {
            return ['used' => 0, 'since' => 0];
        }

        return ['used' => $used, 'since' => $since];
    }

    private static function write(string $key, array $state): void
    {
        if ($state['used'] <= 0 || ! $state['since']) {
            Cache::forget($key);

            return;
        }

        Cache::put($key, $state, max(1, $state['since'] + self::windowSeconds() - now()->timestamp));
    }

    /** What the widget is told: the limit, what is left, and when a new day starts. */
    private static function view(array $state): array
    {
        return [
            'limit' => self::limit(),
            'used' => min($state['used'], self::limit()),
            'left' => max(0, self::limit() - $state['used']),
            /* Milliseconds, the widget's own clock unit; null before the first message. */
            'resets_at' => $state['since'] ? ($state['since'] + self::windowSeconds()) * 1000 : null,
        ];
    }

    /** What is left today on this device — a device with no ID yet has its whole ten. */
    public static function status(?string $device): array
    {
        return self::view($device ? self::read(self::key($device)) : ['used' => 0, 'since' => 0]);
    }

    /**
     * A new device ID for somebody's first message — within the network's
     * day, or null when this address has been given its day's worth.
     *
     * @return array{device: ?string, resets_at: ?int}
     */
    private static function issueDevice(string $address): array
    {
        $key = self::networkKey($address);

        return Cache::lock($key . ':lock', 5)->block(3, function () use ($key) {
            $state = self::read($key);

            if ($state['used'] >= self::newDevicesPerNetwork()) {
                return ['device' => null, 'resets_at' => ($state['since'] + self::windowSeconds()) * 1000];
            }

            $state['used']++;
            $state['since'] = $state['since'] ?: now()->timestamp;
            self::write($key, $state);

            return ['device' => Str::random(32), 'resets_at' => null];
        });
    }

    /**
     * One message, counted — or refused, when the day's are used up.
     *
     * A device with no ID yet (its first message) is given one here, and the
     * widget keeps it. Under a lock, so two tabs on one device sending at
     * once cannot both take the last message.
     *
     * @return array{allowed: bool, reason: ?string, device: ?string, receipt: ?string, limit: int, used: int, left: int, resets_at: ?int}
     */
    public static function take(?string $device, string $address): array
    {
        if (! $device) {
            $issued = self::issueDevice($address);

            if (! $issued['device']) {
                return ['allowed' => false, 'reason' => 'network', 'device' => null, 'receipt' => null]
                    + ['limit' => self::limit(), 'used' => 0, 'left' => 0, 'resets_at' => $issued['resets_at']];
            }

            $device = $issued['device'];
        }

        $key = self::key($device);

        return Cache::lock($key . ':lock', 5)->block(3, function () use ($key, $device) {
            $state = self::read($key);

            if ($state['used'] >= self::limit()) {
                return ['allowed' => false, 'reason' => 'limit', 'device' => self::tokenFor($device), 'receipt' => null] + self::view($state);
            }

            $state['used']++;
            $state['since'] = $state['since'] ?: now()->timestamp;
            self::write($key, $state);

            /* For handing this one message back, once, if the chatbot could
               not be reached to answer it — and by no other device. */
            $receipt = Str::random(40);
            Cache::put('guest-chat-receipt:' . $receipt, $key, self::RECEIPT_SECONDS);

            return ['allowed' => true, 'reason' => null, 'device' => self::tokenFor($device), 'receipt' => $receipt] + self::view($state);
        });
    }

    /**
     * A message the chatbot could not answer, given back.
     *
     * Only with the receipt issued for it, only by the device it was taken
     * for, and only once: the receipt is gone the moment it is used.
     */
    public static function giveBack(?string $device, string $receipt): array
    {
        if (! $device) {
            return self::status(null);
        }

        $key = self::key($device);

        /* Another device's receipt is left alone — not spent, and not this one's to spend. */
        if (Cache::get('guest-chat-receipt:' . $receipt) !== $key) {
            return self::status($device);
        }
        Cache::forget('guest-chat-receipt:' . $receipt);

        return Cache::lock($key . ':lock', 5)->block(3, function () use ($key) {
            $state = self::read($key);
            $state['used'] = max(0, $state['used'] - 1);
            self::write($key, $state);

            return self::view($state['used'] > 0 ? $state : ['used' => 0, 'since' => 0]);
        });
    }
}
