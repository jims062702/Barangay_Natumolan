<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A VAWC respondent is a resident of this barangay, so their details live in
 * the register and not in seven columns beside the case.
 *
 * The migration before this one added `respondent_name`, `respondent_address`,
 * `respondent_contact`, `respondent_sex`, `respondent_birth_date`,
 * `respondent_occupation` and `respondent_civil_status` — typed fields whose
 * only purpose was to carry a respondent the register had never heard of.
 *
 * There is no such respondent. A barangay protection order is issued BY this
 * barangay AGAINST one of its own: the Punong Barangay has no power over
 * somebody who lives elsewhere, and an order naming them is one nobody can
 * serve or enforce. Offering a form field for it invited a case the barangay
 * could not act on, taken from a woman standing at the counter.
 *
 * `respondent_id` stays, and StoreCaseRequest now refuses an id whose record
 * is marked as living outside the barangay.
 *
 * The APPLICANT is untouched and stays unrestricted — she may apply whoever
 * she is and wherever she lives. It is the respondent's residence that
 * decides whether this barangay may act.
 */
return new class extends Migration
{
    private const TYPED = [
        'respondent_name', 'respondent_address', 'respondent_contact',
        'respondent_sex', 'respondent_birth_date', 'respondent_occupation',
        'respondent_civil_status',
    ];

    public function up(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            /* Guarded one by one: the columns arrived in a single migration,
               but a database that skipped it must not fail here. */
            foreach (self::TYPED as $column) {
                if (Schema::hasColumn('vawc_cases', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->text('respondent_name')->nullable()->after('respondent_id');
            $table->text('respondent_address')->nullable()->after('respondent_name');
            $table->text('respondent_contact')->nullable()->after('respondent_address');
            $table->string('respondent_sex', 10)->nullable()->after('respondent_contact');
            $table->date('respondent_birth_date')->nullable()->after('respondent_sex');
            $table->text('respondent_occupation')->nullable()->after('respondent_birth_date');
            $table->string('respondent_civil_status', 30)->nullable()->after('respondent_occupation');
        });
    }
};
