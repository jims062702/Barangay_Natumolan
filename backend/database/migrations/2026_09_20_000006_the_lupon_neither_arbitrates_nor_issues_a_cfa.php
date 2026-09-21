<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Arbitration and the Certificate to File Action come off the docket.
 *
 * Both were real parts of Katarungang Pambarangay and both are being removed
 * on instruction: this barangay's Lupon mediates and conciliates, and a
 * matter it cannot settle is not arbitrated here nor certified out of here.
 *
 * REFUSES TO RUN IF ANYTHING USES THEM. Narrowing an ENUM that still has rows
 * in the values being dropped turns those rows into empty strings silently —
 * a settled case would read as settled by nothing. Better to stop and let a
 * person decide what those cases should say.
 *
 * `cfa_issued` and `cfa_issued_at` are dropped outright rather than left as
 * columns nothing writes: a column that exists is a column somebody will
 * later read and believe.
 */
return new class extends Migration
{
    public function up(): void
    {
        $inUse = [
            'cases at the Arbitration stage' =>
                DB::table('lupon_cases')->where('current_stage', 'Arbitration')->count(),
            'hearings booked as Arbitration' =>
                DB::table('lupon_hearings')->where('hearing_type', 'Arbitration')->count(),
            'settlements recorded as an Arbitration Award' =>
                DB::table('lupon_settlements')->where('settlement_type', 'Arbitration Award')->count(),
            'settlements with a CFA issued' =>
                DB::table('lupon_settlements')->where('cfa_issued', 1)->count(),
            'CFA payments' =>
                DB::table('lupon_payments')->where('kind', 'CFA')->count(),
        ];

        $blocking = array_filter($inUse);

        if ($blocking !== []) {
            $said = [];
            foreach ($blocking as $what => $n) {
                $said[] = "{$n} {$what}";
            }

            throw new RuntimeException(
                'Refusing to remove arbitration and the CFA: ' . implode(', ', $said) . '. '
                    . 'Decide what those records should say first — narrowing the columns '
                    . 'now would blank them.'
            );
        }

        /*
         * Raw ALTER, because Doctrine cannot narrow a MySQL ENUM: the
         * schema builder would drop and recreate the column and take the
         * data with it.
         */
        DB::statement(
            "ALTER TABLE lupon_cases MODIFY current_stage
             ENUM('Filed','Mediation','Conciliation','Settled','Dismissed','Referred')
             NOT NULL DEFAULT 'Filed'"
        );

        DB::statement(
            "ALTER TABLE lupon_hearings MODIFY hearing_type
             ENUM('Mediation','Conciliation') NOT NULL DEFAULT 'Mediation'"
        );

        DB::statement(
            "ALTER TABLE lupon_settlements MODIFY settlement_type
             ENUM('Amicable Settlement') NOT NULL DEFAULT 'Amicable Settlement'"
        );

        Schema::table('lupon_settlements', function (Blueprint $table) {
            foreach (['cfa_issued', 'cfa_issued_at'] as $column) {
                if (Schema::hasColumn('lupon_settlements', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        /* The fee schedule keeps only the filing fee. A CFA payment cannot
           be asked for if no CFA is issued. */
        DB::statement(
            "ALTER TABLE lupon_payments MODIFY kind ENUM('Filing') NOT NULL DEFAULT 'Filing'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE lupon_cases MODIFY current_stage
             ENUM('Filed','Mediation','Conciliation','Arbitration','Settled','Dismissed','Referred')
             NOT NULL DEFAULT 'Filed'"
        );
        DB::statement(
            "ALTER TABLE lupon_hearings MODIFY hearing_type
             ENUM('Mediation','Conciliation','Arbitration') NOT NULL DEFAULT 'Mediation'"
        );
        DB::statement(
            "ALTER TABLE lupon_settlements MODIFY settlement_type
             ENUM('Amicable Settlement','Arbitration Award') NOT NULL DEFAULT 'Amicable Settlement'"
        );
        DB::statement(
            "ALTER TABLE lupon_payments MODIFY kind ENUM('Filing','CFA') NOT NULL DEFAULT 'Filing'"
        );

        Schema::table('lupon_settlements', function (Blueprint $table) {
            $table->boolean('cfa_issued')->default(false);
            $table->timestamp('cfa_issued_at')->nullable();
        });
    }
};
