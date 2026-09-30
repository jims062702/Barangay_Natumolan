<?php

use App\Support\Nationality;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * NATIONALITY ON THE RESIDENT'S OWN RECORD — Q7 of the RBIM.
 *
 * It was only ever on a census line, so a resident registered any other way
 * (the RBIM encoding sheet import, the counter) had none, and their Resident
 * ID printed a dash. The record now carries it, in words — "Filipino", or
 * what a 2 on the form said ("Japanese") — and the ID prints the record.
 *
 * Filled here from every census line already linked to a resident (their
 * latest answer); residents imported from the RBIM sheet are filled from the
 * sheet itself by `php artisan residents:rbim-backfill`, which only fills a
 * blank. Nobody is given a nationality nobody recorded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('residents', function (Blueprint $table) {
            $table->string('nationality', 100)->nullable()->after('birth_place');
        });

        $answers = DB::table('rbim_census_members')
            ->whereNotNull('resident_id')
            ->whereNotNull('q7_nationality')
            ->orderBy('updated_at')
            ->orderBy('id')
            ->get(['resident_id', 'q7_nationality', 'q7_nationality_other']);

        /* The latest answer for each resident wins. */
        $latest = [];
        foreach ($answers as $answer) {
            $latest[$answer->resident_id] = Nationality::fromCode($answer->q7_nationality, $answer->q7_nationality_other);
        }

        foreach (array_filter($latest) as $residentId => $nationality) {
            DB::table('residents')->where('id', $residentId)->whereNull('nationality')->update(['nationality' => $nationality]);
        }
    }

    public function down(): void
    {
        Schema::table('residents', function (Blueprint $table) {
            $table->dropColumn('nationality');
        });
    }
};
