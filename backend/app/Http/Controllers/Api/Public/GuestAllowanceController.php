<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Services\Chat\GuestAllowance;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;

/**
 * The chatbot's guest limit — see GuestAllowance. The widget asks here
 * before it sends a guest's message anywhere, and names its device in the
 * X-Guest-Device header (the ID it was given with its first message).
 */
class GuestAllowanceController extends BaseController
{
    public const USED_UP = 'You’ve reached the guest chat limit for today. Please log in as a registered '
        . 'resident to continue chatting with the Barangay Natumolan chatbot.';

    public const NETWORK_FULL = 'Guest chat has reached today’s limit for new devices on this network. Please log '
        . 'in as a registered resident to continue chatting with the Barangay Natumolan chatbot.';

    /** The device this request comes from — null for none, or one that was made up. */
    private function device(Request $request): ?string
    {
        return GuestAllowance::deviceFrom($request->header('X-Guest-Device'));
    }

    /** What is left today, on this device. */
    public function show(Request $request)
    {
        return $this->success(GuestAllowance::status($this->device($request)), 'Guest chat allowance');
    }

    /** One message, counted — 429 when the day's are used up. */
    public function take(Request $request)
    {
        try {
            $result = GuestAllowance::take($this->device($request), (string) $request->ip());
        } catch (LockTimeoutException) {
            return $this->error('The chatbot is busy. Please try again in a moment.', 503);
        }

        if (! $result['allowed']) {
            return response()->json([
                'success' => false,
                'message' => $result['reason'] === 'network' ? self::NETWORK_FULL : self::USED_UP,
                'data' => collect($result)->except('allowed')->all(),
            ], 429);
        }

        return $this->success(collect($result)->except(['allowed', 'reason'])->all(), 'Counted');
    }

    /** A message the chatbot could not answer, handed back with its receipt. */
    public function giveBack(Request $request)
    {
        $data = $request->validate([
            'receipt' => ['required', 'string', 'size:40', 'alpha_num'],
        ]);

        try {
            return $this->success(GuestAllowance::giveBack($this->device($request), $data['receipt']), 'Given back');
        } catch (LockTimeoutException) {
            return $this->error('The chatbot is busy. Please try again in a moment.', 503);
        }
    }
}
