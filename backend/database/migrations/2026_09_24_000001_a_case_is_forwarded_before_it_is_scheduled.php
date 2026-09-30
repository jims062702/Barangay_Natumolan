<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Two stages for a case that is on somebody's desk but not yet on a calendar.
 *
 * The hall works like this: the Lupon sees the receipt, and the case is
 * FORWARDED — to the Barangay Secretary, who prints the summons, and the
 * printing is what books the three Tuesdays with the Punong Barangay. Booking
 * the Tuesdays at the moment the fee was confirmed skipped that forwarding
 * entirely: the Secretary had no list of cases waiting on them, only a
 * calendar that had filled itself, and the office asked the obvious question
 * — what is it that reaches me, and how do I know it has?
 *
 *   For Summons         the fee is paid; the Barangay Secretary prints, and
 *                       three Tuesdays follow
 *   For Lupon Summons   the three Tuesdays are spent with no agreement, so
 *                       the case is with the Lupon; the Lupon prints, and
 *                       three Thursdays follow
 *
 * Both are waiting rooms with a name, which is the point: a case sitting in
 * one can be listed, counted and chased. "Mediation" with no hearing on it
 * could not be told apart from a case whose sittings were all behind it.
 */
return new class extends Migration
{
    private const STAGES = "'Filed','For Summons','Mediation','For Lupon Summons','Conciliation','Settled','Dismissed','Referred','CFA','Withdrawn'";

    private const OLD_STAGES = "'Filed','Mediation','Conciliation','Settled','Dismissed','Referred','CFA','Withdrawn'";

    public function up(): void
    {
        DB::statement('ALTER TABLE lupon_cases MODIFY current_stage ENUM(' . self::STAGES . ") NOT NULL DEFAULT 'Filed'");
    }

    public function down(): void
    {
        /*
         * A case waiting on a summons has no sitting behind it, so it goes
         * back to where it was before the fee was confirmed rather than to a
         * stage whose hearings do not exist.
         */
        DB::table('lupon_cases')->where('current_stage', 'For Summons')->update(['current_stage' => 'Filed']);
        DB::table('lupon_cases')->where('current_stage', 'For Lupon Summons')->update(['current_stage' => 'Mediation']);

        DB::statement('ALTER TABLE lupon_cases MODIFY current_stage ENUM(' . self::OLD_STAGES . ") NOT NULL DEFAULT 'Filed'");
    }
};
