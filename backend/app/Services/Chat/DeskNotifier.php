<?php

namespace App\Services\Chat;

use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Chat\Conversation;
use Illuminate\Support\Str;

final class DeskNotifier
{
    /**
     * Roles that staff the live desk.
     *
     * THE CLERK, AND ONLY THE CLERK. The Secretary used to staff it. The desk
     * moved to the counter — the person asked "how do I get a clearance?"
     * should be the one who issues it — and this list was left behind, so a
     * resident asking to speak to somebody rang the one desk that can no
     * longer answer. The Punong Barangay was taken off it too (2026-09-30).
     * The API says the same thing (deny_role:Secretary,Punong Barangay on
     * routes/api/chat-desk.php); the two have to agree or the ring goes to a
     * page the person cannot open.
     *
     * Admin is off it as well: they keep accounts and the landing page, and
     * their office cannot reach the desk at all.
     */
    private const AGENT_ROLES = ['Clerk'];

    /** Rings every account that staffs the live desk. */
    public function notify(
        Conversation $conversation,
        string $preview,
        bool $followUp = false,
    ): void {
        $ids = User::where('is_active', true)
            ->whereIn('role', self::AGENT_ROLES)
            ->pluck('id');

        /*
         * A follow-up says so in the title. Read as a fresh enquiry it looks
         * like a resident who has not been helped yet, and the desk answers a
         * question it has already answered.
         */
        $title = $followUp
            ? 'Live chat follow-up: ' . $conversation->visitor_name
            : 'Live chat: ' . $conversation->visitor_name . ' needs help';

        Notification::notifyUsers(
            $ids,
            'chat_waiting',
            $title,
            Str::limit($preview, 140),
            'chat',
            $conversation->id
        );
    }
}
