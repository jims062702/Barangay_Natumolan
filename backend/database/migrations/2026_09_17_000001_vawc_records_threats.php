<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The VAWC desk records a threat as well as an act.
 *
 * `violence_type` was an ENUM of five kinds, and the intake form now offers
 * two: Threat and Physical. "Threat" was not one of the five, so choosing it
 * would have been refused by the column itself — a 422 at the counter with a
 * complainant standing there.
 *
 * ADDED, NOT REPLACED. The other four stay in the enum even though the form
 * no longer offers them: a case already on the register was taken down as
 * "Psychological" and that is what happened, whatever the desk files today.
 * Narrowing the column would rewrite history to match a form.
 */
return new class extends Migration
{
    private const WITH_THREAT = "enum('Threat','Physical','Psychological','Economic','Sexual','Mixed')";
    private const WITHOUT = "enum('Physical','Psychological','Economic','Sexual','Mixed')";

    public function up(): void
    {
        /* Raw, because Laravel's schema builder cannot alter an ENUM's
           members without doctrine/dbal, and the column is NOT NULL with no
           default either way. */
        DB::statement('ALTER TABLE vawc_cases MODIFY violence_type ' . self::WITH_THREAT . ' NOT NULL');
    }

    public function down(): void
    {
        /*
         * Refuses rather than silently mangles.
         *
         * Going back means the column can no longer hold "Threat", and MySQL
         * would turn every such row into an empty string — a case whose kind
         * of violence quietly becomes blank. If there are none, the rollback
         * is safe and proceeds.
         */
        $threats = DB::table('vawc_cases')->where('violence_type', 'Threat')->count();

        if ($threats > 0) {
            throw new RuntimeException(
                "Cannot roll back: {$threats} case(s) are recorded as 'Threat' and that kind "
                . 'would be erased. Re-classify them first.'
            );
        }

        DB::statement('ALTER TABLE vawc_cases MODIFY violence_type ' . self::WITHOUT . ' NOT NULL');
    }
};
