<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Lupon's room, as the hall actually runs it.
 *
 *   Withdrawn   the complainant took the complaint back; the case is closed
 *               and the sittings still on the calendar are stood down
 *   CFA         the Lupon certified the case to file action, so the
 *               complainant may take it to court
 *
 * Both are ends of a case that the docket could not say before: a withdrawn
 * complaint was left sitting Filed for ever, and a case certified to court
 * was recorded as "Dismissed", which is not what the certificate says.
 *
 * `closure_reason` holds the words that go with either — why it was taken
 * back, or what the certification says — and `summons_printed_at` records
 * the moment the Secretary printed the summons, which is when the parties
 * are told the schedule and the case reaches their portal.
 */
return new class extends Migration
{
    private const STAGES = "'Filed','Mediation','Conciliation','Settled','Dismissed','Referred','CFA','Withdrawn'";

    private const OLD_STAGES = "'Filed','Mediation','Conciliation','Settled','Dismissed','Referred'";

    public function up(): void
    {
        DB::statement("ALTER TABLE lupon_cases MODIFY current_stage ENUM(" . self::STAGES . ") NOT NULL DEFAULT 'Filed'");

        Schema::table('lupon_cases', function (Blueprint $table) {
            $table->string('closure_reason', 255)->nullable()->after('date_resolved');
        });

        Schema::table('lupon_hearings', function (Blueprint $table) {
            $table->dateTime('summons_printed_at')->nullable()->after('summons_issued');
        });

        /*
         * Every summons already issued was printed at the counter — the
         * paper is what "issued" meant. Dated from the hearing's own record
         * so the two never disagree about whether one exists.
         */
        DB::statement('UPDATE lupon_hearings SET summons_printed_at = created_at WHERE summons_issued = 1');
    }

    public function down(): void
    {
        DB::table('lupon_cases')->whereIn('current_stage', ['CFA', 'Withdrawn'])->update(['current_stage' => 'Dismissed']);

        DB::statement("ALTER TABLE lupon_cases MODIFY current_stage ENUM(" . self::OLD_STAGES . ") NOT NULL DEFAULT 'Filed'");

        Schema::table('lupon_cases', function (Blueprint $table) {
            $table->dropColumn('closure_reason');
        });

        Schema::table('lupon_hearings', function (Blueprint $table) {
            $table->dropColumn('summons_printed_at');
        });
    }
};
