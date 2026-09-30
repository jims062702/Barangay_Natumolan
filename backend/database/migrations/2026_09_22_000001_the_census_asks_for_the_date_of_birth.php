<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Q5 is the DATE of birth.
 *
 * The census form asked for a birth month and a year, and the register made
 * a date out of them — the last day of that month, marked estimated. The
 * office has asked for the date itself: the register is used for
 * certificates and for who is a senior citizen, and a date a month out is
 * not good enough for either.
 *
 * The month and year stay, filled in FROM the date when the form is saved.
 * They are what the RBIM codebook, its encoding sheet and every form saved
 * before today speak in, and a sheet that only ever had a month and a year
 * is still read by them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rbim_census_members', function (Blueprint $table) {
            $table->date('q5_birthdate')->nullable()->after('q5_birth_year');
        });
    }

    public function down(): void
    {
        Schema::table('rbim_census_members', function (Blueprint $table) {
            $table->dropColumn('q5_birthdate');
        });
    }
};
