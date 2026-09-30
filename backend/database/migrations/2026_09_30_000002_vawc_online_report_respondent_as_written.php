<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where the respondent lives, as she wrote it (2026-09-30).
 *
 * A VAWC online complaint no longer searches the register for the respondent:
 * she writes who it is and where they live, and the VAW Desk finds them on
 * the register when it verifies the complaint — as the Lupon does with its
 * online complaints. The name had a column already (encrypted); the address
 * joins it, encrypted the same way, so TEXT.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->text('respondent_address')->nullable()->after('respondent_name');
        });
    }

    public function down(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->dropColumn('respondent_address');
        });
    }
};
