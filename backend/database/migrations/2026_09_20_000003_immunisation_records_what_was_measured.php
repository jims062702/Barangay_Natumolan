<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What was measured when the jab was given.
 *
 * The immunisation record kept the vaccine, the date and the lot number, and
 * nothing about the child in front of the nurse. The ITR's immunisation
 * column sits beside height, weight and temperature for a reason: a dose is
 * judged against the child's size, and a fever is why one gets deferred.
 *
 * Zone, name, sex and address are NOT added here. They are on the resident
 * record this row already points at, and copying them would give the station
 * two answers to "where does this child live?" — the wrong one being the one
 * written down a year ago.
 *
 * The vaccine list itself (BCG, Penta 1-3, OPV 1-3, IPV 1-3, PCV 1-3,
 * MCV 1-2) stays as one ROW PER DOSE rather than becoming twenty columns.
 * Each dose has its own date, its own lot number and its own nurse, which a
 * column cannot hold; the card that shows them all at once is a view over
 * these rows, which is exactly what the paper form is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('immunization_records', function (Blueprint $table) {
            $table->decimal('height_cm', 5, 1)->nullable()->after('vaccination_date');
            $table->decimal('weight_kg', 5, 2)->nullable()->after('height_cm');
            $table->decimal('temperature', 4, 1)->nullable()->after('weight_kg');
        });
    }

    public function down(): void
    {
        Schema::table('immunization_records', function (Blueprint $table) {
            $table->dropColumn(['height_cm', 'weight_kg', 'temperature']);
        });
    }
};
