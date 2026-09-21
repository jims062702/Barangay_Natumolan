<?php

namespace App\Services\Chat;

use App\Models\Chat\Conversation;

/**
 * What each side of a conversation is shown.
 *
 * The resident and the desk read the same conversation, but not the same
 * facts about it: a resident never sees a staff account's id, and the desk
 * sees who came back and how often.
 */
final class ConversationViews
{
    /** What the visitor may see: never the internal ids of staff accounts. */
    public function visitor(Conversation $conversation): array
    {
        return [
            'status' => $conversation->status,
            'agent_name' => $conversation->agent?->name,
            'agent_role' => $conversation->agent?->role,
            'unread' => $conversation->unread_for_visitor,
            'last_message_at' => $conversation->last_message_at,
            'closed_at' => $conversation->closed_at,
            /* So the widget knows to offer "ask a follow-up" rather than a
               disabled box, and can say it has been reopened before. */
            'follow_up_count' => $conversation->follow_up_count,
        ] + $this->queue($conversation);
    }

    public function agent(Conversation $conversation): array
    {
        return [
            'id' => $conversation->id,
            'visitor_name' => $conversation->visitor_name,
            'is_resident' => (bool) $conversation->resident_id,
            'resident_id' => $conversation->resident_id,
            'guest_email' => $conversation->guest_email,
            'guest_contact' => $conversation->guest_contact,
            'topic' => $conversation->topic,
            'status' => $conversation->status,
            'assigned_to' => $conversation->assigned_to,
            'agent_name' => $conversation->agent?->name,
            'unread' => $conversation->unread_for_agent,
            'last_message_at' => $conversation->last_message_at,
            'created_at' => $conversation->created_at,
            'closed_at' => $conversation->closed_at,

            /*
             * That this is a resident coming back, and how often.
             *
             * Once is somebody who forgot to ask something. Four times is a
             * matter the desk keeps closing without settling, and the count
             * is the only place that shows.
             */
            'follow_up_count' => $conversation->follow_up_count,
            'reopened_at' => $conversation->reopened_at,
            'last_closed_at' => $conversation->last_closed_at,
        ];
    }

    public function message($message): array
    {
        return [
            'id' => $message->id,
            'sender' => $message->sender,
            // Staff messages are signed, so the resident knows who answered.
            'sender_name' => $message->sender === 'agent'
                ? ($message->user?->name ?? 'Barangay Clerk')
                : null,
            'body' => $message->body,
            'created_at' => $message->created_at,
        ];
    }

    /**
     * Where this person stands in the line.
     *
     * One Clerk answers one person at a time, so anybody who is not first
     * is waiting behind somebody — and a wait with no number attached feels
     * like being ignored. Telling them they are third is the difference
     * between waiting and wondering whether the thing is broken at all.
     *
     * Ordered by ARRIVAL, never by last message: ranking on the latest
     * message would send a person to the back of the queue for asking whether
     * anyone is there.
     */
    private function queue(Conversation $conversation): array
    {
        if ($conversation->status !== 'Waiting') {
            return ['queue_position' => null, 'queue_total' => 0];
        }

        $waiting = Conversation::where('status', 'Waiting');

        return [
            'queue_position' => (clone $waiting)
                ->where('created_at', '<=', $conversation->created_at)
                ->where('id', '<=', $conversation->id)
                ->count(),
            'queue_total' => $waiting->count(),
        ];
    }
}
