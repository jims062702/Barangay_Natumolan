<?php

namespace App\Services\Chat;

use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Chat\Conversation;
use Illuminate\Support\Str;

final class DeskNotifier
{
    /** Roles that staff the live desk. */
    private const AGENT_ROLES = ['Secretary', 'Punong Barangay', 'Admin'];

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
