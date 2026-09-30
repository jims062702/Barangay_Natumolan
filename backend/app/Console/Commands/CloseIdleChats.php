<?php

namespace App\Console\Commands;

use App\Services\Chat\IdleConversations;
use Illuminate\Console\Command;

/**
 * Closes live conversations the resident stopped answering.
 *
 * Once the Clerk has replied, the resident has a day (CHAT_IDLE_CLOSE_HOURS)
 * to answer; after that the conversation is closed, with a line in the thread
 * saying so. One whose last word is the resident's is never closed — that one
 * is waiting on the desk. See IdleConversations.
 *
 * The desk and the widget run the same rule whenever they load, so this is
 * for the hours when nobody has either open.
 */
class CloseIdleChats extends Command
{
    protected $signature = 'chat:close-idle
                            {--dry-run : Count them without closing anything}';

    protected $description = 'Close live chats whose resident has not replied to the desk in a day';

    public function handle(): int
    {
        if ($this->option('dry-run')) {
            $this->info(IdleConversations::stale()->count() . ' conversation(s) would be closed.');

            return self::SUCCESS;
        }

        $this->info(IdleConversations::closeStale() . ' conversation(s) closed.');

        return self::SUCCESS;
    }
}
