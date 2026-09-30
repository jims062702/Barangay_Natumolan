<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Health records that keep their history — and that belong to residents.
 *
 * WHAT WAS WRONG. The child and maternal records were one row per person,
 * saved with updateOrCreate: a child's second weighing replaced the first,
 * and a mother's second pregnancy replaced her first — with its visit count
 * typed in by hand. A record system that forgets is not a record system.
 *
 * WHAT THIS DOES, reusing the tables that exist rather than adding copies:
 *
 *   maternal_health  IS the pregnancy. One row per pregnancy, not per
 *                    mother. Its visit count is no longer stored — it is
 *                    COUNT(prenatal records of that pregnancy), so it can
 *                    never drift from the records themselves.
 *   prenatal_visits  the prenatal record, with what the station's paper
 *                    register asks (WT, BP, HT, LMP, EDC, MOS) and the
 *                    pregnancy it belongs to.
 *   child_health     one row per weighing, with its date.
 *
 * THE POPULATION OFFICE OWNS WHO PEOPLE ARE. Every one of these rows points
 * at a resident on the register — the child, the mother — and keeps none of
 * that person's details itself: name, birth date, address, contact and zone
 * are read from the register. There is no "not yet listed" person here; a
 * child is registered by the Population Office before the station records
 * them. (The prenatal line keeps the age, zone and contact AS THEY WERE on
 * the day, because that is what the paper register records — set by the
 * server from the register, never typed.)
 *
 * AND A RESIDENT WITH HEALTH HISTORY CANNOT BE DELETED out from under it:
 * the foreign keys restrict (they cascaded — delete a resident and their
 * history went too). The register's own delete already refuses a resident
 * with records that must be kept, and offers to deactivate them instead.
 *
 * Every table here was empty when this was written (0 rows), so nothing is
 * moved or converted.
 */
return new class extends Migration
{
    public function up(): void
    {
        /* --- the pregnancy --- */
        Schema::table('maternal_health', function (Blueprint $table) {
            $table->dropForeign(['mother_id']);
        });
        Schema::table('maternal_health', function (Blueprint $table) {
            $table->unsignedBigInteger('mother_id')->nullable(false)->change();
            $table->foreign('mother_id')->references('id')->on('residents')->restrictOnDelete();

            $table->date('lmp')->nullable()->after('pregnancy_registration_date');

            /* Completion: Delivered (with the delivery date that already
               exists) or Closed (with the staff's reason). Nothing is
               invented about the outcome. */
            $table->date('completed_at')->nullable()->after('status');
            $table->foreignId('completed_by')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
            $table->string('closure_note', 255)->nullable()->after('completed_by');

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->dropColumn('prenatal_visits_count');
            $table->index(['mother_id', 'status']);
        });

        /* --- the prenatal record --- */
        Schema::table('prenatal_visits', function (Blueprint $table) {
            $table->dropForeign(['mother_id']);
        });
        Schema::table('prenatal_visits', function (Blueprint $table) {
            $table->unsignedBigInteger('mother_id')->nullable(false)->change();
            $table->foreign('mother_id')->references('id')->on('residents')->restrictOnDelete();

            /* Restrict, not cascade: a pregnancy with records cannot be
               deleted out from under them. */
            $table->foreignId('pregnancy_id')->after('id')->constrained('maternal_health')->restrictOnDelete();

            $table->decimal('weight_kg', 5, 2)->nullable()->after('zone_purok');
            $table->string('blood_pressure', 20)->nullable()->after('weight_kg');
            $table->decimal('height_cm', 5, 2)->nullable()->after('blood_pressure');
            $table->date('lmp')->nullable()->after('height_cm');
            $table->date('edc')->nullable()->after('lmp');
            /* As written on the register — "8 mos" — kept exactly. */
            $table->string('months_of_pregnancy', 20)->nullable()->after('edc');
            $table->foreignId('updated_by')->nullable()->after('recorded_by')->constrained('users')->nullOnDelete();

            $table->index(['pregnancy_id', 'visit_date']);
        });

        /* --- one weighing --- */
        Schema::table('child_health', function (Blueprint $table) {
            $table->dropForeign(['child_id']);
        });
        Schema::table('child_health', function (Blueprint $table) {
            $table->unsignedBigInteger('child_id')->nullable(false)->change();
            $table->foreign('child_id')->references('id')->on('residents')->restrictOnDelete();

            $table->date('record_date')->after('child_id');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->index(['child_id', 'record_date']);
            $table->index('record_date');
        });
    }

    public function down(): void
    {
        Schema::table('child_health', function (Blueprint $table) {
            $table->dropForeign(['child_id']);
            $table->dropForeign(['created_by']);
            $table->dropForeign(['updated_by']);
            $table->dropIndex(['child_id', 'record_date']);
            $table->dropIndex(['record_date']);
            $table->dropColumn(['record_date', 'created_by', 'updated_by']);
        });
        Schema::table('child_health', function (Blueprint $table) {
            $table->foreign('child_id')->references('id')->on('residents')->cascadeOnDelete();
        });

        Schema::table('prenatal_visits', function (Blueprint $table) {
            $table->dropForeign(['pregnancy_id']);
            $table->dropForeign(['updated_by']);
            $table->dropForeign(['mother_id']);
            $table->dropIndex(['pregnancy_id', 'visit_date']);
            $table->dropColumn(['pregnancy_id', 'weight_kg', 'blood_pressure', 'height_cm', 'lmp', 'edc',
                'months_of_pregnancy', 'updated_by']);
        });
        Schema::table('prenatal_visits', function (Blueprint $table) {
            $table->foreign('mother_id')->references('id')->on('residents')->cascadeOnDelete();
        });

        Schema::table('maternal_health', function (Blueprint $table) {
            $table->dropForeign(['completed_by']);
            $table->dropForeign(['created_by']);
            $table->dropForeign(['updated_by']);
            $table->dropForeign(['mother_id']);
            $table->dropIndex(['mother_id', 'status']);
            $table->dropColumn(['lmp', 'completed_at', 'completed_by', 'closure_note', 'created_by', 'updated_by']);
            $table->integer('prenatal_visits_count')->default(0);
        });
        Schema::table('maternal_health', function (Blueprint $table) {
            $table->foreign('mother_id')->references('id')->on('residents')->cascadeOnDelete();
        });
    }
};
