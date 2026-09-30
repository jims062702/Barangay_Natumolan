<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * A RESIDENT ID'S HISTORY, AND ONE ACTIVE CARD PER PERSON — BY THE DATABASE.
 *
 *   card_no           the card's own reference, printed on it: RID-<resident
 *                     number>-<which card>, e.g. RID-2026-000001-02 for the
 *                     second card ever issued to that resident. Not a secret —
 *                     the verification code is the secret.
 *   action            Issued (their first) or Reissued (a replacement)
 *   replaces_card_id  the card a replacement took over from
 *   reason            why it was replaced, when the office said
 *   active_for        the resident's id while the card is Active, NULL once
 *                     revoked — and UNIQUE, so a second active card for the
 *                     same person cannot be written by any path, a double
 *                     click and a bulk issue at the same moment included.
 *
 * Nothing is deleted or rewritten: every card ever issued stays, with who
 * issued it and when, and who revoked it and why.
 *
 * And the Online Complaint gets its Nature of the Case — the complainant's
 * own choice, which the Lupon confirms or changes when it accepts it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resident_cards', function (Blueprint $table) {
            $table->string('card_no', 40)->nullable()->after('resident_id');
            $table->string('action', 10)->default('Issued')->after('status');
            $table->foreignId('replaces_card_id')->nullable()->after('action')->constrained('resident_cards')->nullOnDelete();
            $table->string('reason', 255)->nullable()->after('replaces_card_id');
        });

        /* The cards already issued, numbered and linked in the order they were issued. */
        $cards = DB::table('resident_cards')
            ->join('residents', 'residents.id', '=', 'resident_cards.resident_id')
            ->orderBy('resident_cards.resident_id')->orderBy('resident_cards.id')
            ->get(['resident_cards.id', 'resident_cards.resident_id', 'residents.resident_number']);
        $seen = [];
        foreach ($cards as $card) {
            $n = ($seen[$card->resident_id]['n'] ?? 0) + 1;
            DB::table('resident_cards')->where('id', $card->id)->update([
                'card_no' => 'RID-' . $card->resident_number . '-' . str_pad((string) $n, 2, '0', STR_PAD_LEFT),
                'action' => $n === 1 ? 'Issued' : 'Reissued',
                'replaces_card_id' => $seen[$card->resident_id]['id'] ?? null,
            ]);
            $seen[$card->resident_id] = ['n' => $n, 'id' => $card->id];
        }

        Schema::table('resident_cards', function (Blueprint $table) {
            $table->unique('card_no');
        });

        DB::statement("ALTER TABLE resident_cards ADD COLUMN active_for BIGINT UNSIGNED AS (IF(status = 'Active', resident_id, NULL)) PERSISTENT");
        DB::statement('ALTER TABLE resident_cards ADD UNIQUE KEY resident_cards_one_active (active_for)');

        Schema::table('online_complaints', function (Blueprint $table) {
            $table->string('case_classification', 100)->nullable()->after('respondent_address');
        });
    }

    public function down(): void
    {
        Schema::table('online_complaints', function (Blueprint $table) {
            $table->dropColumn('case_classification');
        });

        DB::statement('ALTER TABLE resident_cards DROP INDEX resident_cards_one_active');
        DB::statement('ALTER TABLE resident_cards DROP COLUMN active_for');

        Schema::table('resident_cards', function (Blueprint $table) {
            $table->dropUnique(['card_no']);
            $table->dropConstrainedForeignId('replaces_card_id');
            $table->dropColumn(['card_no', 'action', 'reason']);
        });
    }
};
