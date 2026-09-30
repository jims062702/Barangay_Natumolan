<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * A VAWC REPORT SENT ONLINE — by a RESIDENT, identified by their Barangay
 * Resident ID. Not a case: a report the VAW Desk verifies, and only then
 * opens as a case (vawc_case_id).
 *
 * Everything she wrote is encrypted at rest, as the desk's own case records
 * are: the account, where it happened, who did it, and how to reach her
 * safely. What stays readable is only what the desk sorts its queue by —
 * when, the status, and whether she was threatened (which decides whether
 * she must come in before it is verified).
 *
 * vawc_online_report_views is the report's own access trail: who opened it,
 * who looked at the ID. A report is read before it is a case, and reading it
 * is written down all the same.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vawc_online_reports', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 30)->unique();
            $table->foreignId('resident_id')->constrained('residents')->restrictOnDelete();
            $table->foreignId('resident_card_id')->nullable()->constrained('resident_cards')->nullOnDelete();
            $table->string('filed_via', 10);
            $table->text('violence_types');
            $table->text('narrative');
            $table->date('occurred_on')->nullable();
            $table->text('place')->nullable();
            $table->text('respondent_name')->nullable();
            $table->string('relationship', 40)->nullable();
            $table->boolean('threatened');
            $table->boolean('in_danger_now');
            $table->text('safe_contact')->nullable();
            $table->text('safe_time')->nullable();
            $table->string('id_path');
            $table->string('status', 20)->default('For Verification');
            $table->boolean('visit_required');
            $table->boolean('confirmed_in_person')->default(false);
            $table->foreignId('vawc_case_id')->nullable()->constrained('vawc_cases')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('office_note')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['resident_id', 'created_at']);
        });

        Schema::create('vawc_online_report_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vawc_online_report_id')->constrained('vawc_online_reports')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vawc_online_report_views');
        Schema::dropIfExists('vawc_online_reports');
    }
};
