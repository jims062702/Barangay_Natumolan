<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who spoke last in a live conversation, and when each side did (2026-09-30).
 *
 * A conversation closes by itself once the Clerk has answered and the
 * resident has said nothing for a day (App\Services\Chat\IdleConversations).
 * That turns on who spoke LAST, and `last_message_at` cannot say — a system
 * line moves it too. Nor can two times, to the second: a reply sent within
 * the second of the question is a tie. So the speaker itself is kept, by
 * Conversation::addMessage, and filled here from the messages on record.
 *
 * Nullable dateTime, not timestamp: a table's first non-null TIMESTAMP is
 * given ON UPDATE CURRENT_TIMESTAMP by MariaDB, in Manila time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->enum('last_speaker', ['visitor', 'agent'])->nullable()->after('last_message_at');
            $table->dateTime('last_visitor_message_at')->nullable()->after('last_speaker');
            $table->dateTime('last_agent_message_at')->nullable()->after('last_visitor_message_at');
        });

        foreach (['visitor' => 'last_visitor_message_at', 'agent' => 'last_agent_message_at'] as $sender => $column) {
            DB::statement(
                "UPDATE chat_conversations c
                    SET c.$column = (SELECT MAX(m.created_at) FROM chat_messages m
                                     WHERE m.chat_conversation_id = c.id AND m.sender = ?)",
                [$sender]
            );
        }

        /* The sender of the newest line that is not the system's. */
        DB::statement(
            "UPDATE chat_conversations c
                SET c.last_speaker = (SELECT m.sender FROM chat_messages m
                                      WHERE m.chat_conversation_id = c.id AND m.sender <> 'system'
                                      ORDER BY m.id DESC LIMIT 1)"
        );
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn(['last_speaker', 'last_visitor_message_at', 'last_agent_message_at']);
        });
    }
};
