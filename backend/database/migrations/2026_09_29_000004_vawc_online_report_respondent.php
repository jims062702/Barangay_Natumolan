<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * THE RESPONDENT OF A VAWC ONLINE COMPLAINT IS A RESIDENT ON THE REGISTER.
 *
 * The office's rule (2026-09-29): both the complainant and the respondent of
 * a VAWC complaint sent online are registered residents of Barangay
 * Natumolan — the complainant proven by her Resident ID, the respondent
 * chosen from the register. It is the same rule the desk already keeps for a
 * case (a barangay protection order can only be issued against one of its
 * own), so the case the complaint becomes carries the same respondent.
 *
 * Nullable only for the complaints sent before the rule, which named the
 * respondent in words (respondent_name).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->foreignId('respondent_id')->nullable()->after('respondent_name')
                ->constrained('residents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('respondent_id');
        });
    }
};
