<?php

namespace App\Services\Chat;

use App\Models\Chat\Conversation;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;

/**
 * A conversation the resident has walked away from closes by itself
 * (2026-09-30).
 *
 * The desk takes as many conversations at once as come in, so a thread
 * nobody finishes is no longer only one person's problem — it sits in the
 * Clerk's open list for good. So: once the Clerk has answered, the resident
 * has a day to reply, and after that the conversation is closed.
 *
 * ONLY WHEN THE RESIDENT OWES THE REPLY. A conversation whose last word is
 * the resident's is waiting on the desk, however old — closing that would be
 * the barangay ignoring somebody and calling it tidying up. And nothing is
 * lost: the thread is kept, the resident can still read it, and a follow-up
 * reopens it with everything already said (ResidentChatController::followUp).
 */
final class IdleConversations
{
    /** How long the resident has to reply. */
    public static function hours(): int
    {
        return max(1, (int) config('barangay.chat.idle_close_hours', 24));
    }

    /**
     * When this conversation will close by itself — or null while the reply
     * is the desk's to give.
     */
    public static function closesAt(Conversation $conversation): ?CarbonInterface
    {
        if (! in_array($conversation->status, ['Waiting', 'Active'], true)) {
            return null;
        }

        /* The SPEAKER, not two times compared: a reply within the second of
           the question would be a tie. */
        if ($conversation->last_speaker !== 'agent' || ! $conversation->last_agent_message_at) {
            return null;
        }

        return $conversation->last_agent_message_at->copy()->addHours(self::hours());
    }

    /** The open conversations whose resident has not answered the desk in time. */
    public static function stale(): Builder
    {
        $cutoff = now()->subHours(self::hours());

        return Conversation::whereIn('status', ['Waiting', 'Active'])
            ->where('last_speaker', 'agent')
            ->where('last_agent_message_at', '<=', $cutoff);
    }

    /**
     * Closes every stale conversation, with a line in the thread that says
     * why. Returns how many.
     */
    public static function closeStale(): int
    {
        $closed = 0;

        self::stale()->orderBy('id')->each(function (Conversation $conversation) use (&$closed) {
            $conversation->addMessage(
                'system',
                'Closed automatically: the resident did not reply for ' . self::inWords() . '. '
                    . 'A follow-up message reopens it.'
            );
            $conversation->update(['status' => 'Closed', 'closed_at' => now()]);
            $closed++;
        });

        return $closed;
    }

    /**
     * The same, at most once a minute — for the pages both sides keep open.
     *
     * The scheduler runs `chat:close-idle` every hour, when it runs at all;
     * on a machine where nobody set it up, the desk and the widget asking
     * for their lists is what keeps the rule.
     */
    public static function sweep(): void
    {
        if (Cache::add('chat:idle-sweep', true, 60)) {
            self::closeStale();
        }
    }

    /** "a day", "2 days", "12 hours". */
    public static function inWords(): string
    {
        $hours = self::hours();

        if ($hours % 24 === 0) {
            $days = intdiv($hours, 24);

            return $days === 1 ? 'a day' : $days . ' days';
        }

        return $hours . ' hours';
    }
}
