<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RBIM Q32 — "In what barangay is ___ a registered voter?" — on the resident.
 *
 * The census asked it of everybody fifteen and over and the encoding sheet
 * carries the answer, but the register had nowhere to put it: it stopped at
 * the census line, and the resident's own record could not say whether they
 * vote here. Free text, as the form asks it — "Barangay Natumolan", another
 * place, or "Not a registered voter".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('residents', function (Blueprint $table) {
            $table->string('registered_voter_in', 150)->nullable()->after('educational_attainment');
        });
    }

    public function down(): void
    {
        Schema::table('residents', function (Blueprint $table) {
            $table->dropColumn('registered_voter_in');
        });
    }
};
