<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The barangay's zones, and the health worker who covers each.
 *
 * Until now "Purok 1" to "Purok 5" was typed into four separate dropdowns in
 * the frontend. Barangay Natumolan has twenty-five zones, named nothing like
 * that — Zone 6A, Zone 18B, Zone 21C — so every one of those lists was
 * offering a choice that does not exist, and the register could not record
 * where anybody actually lives.
 *
 * A LIST IN THE DATABASE, not in the code, because the Population Office has
 * to be able to add a zone the day it is created. A zone splitting into A and
 * B is an ordinary event here — three have already done it — and it should
 * not need a developer.
 *
 * ONE BHW PER ZONE, MANY ZONES PER BHW. That is how the assignment actually
 * works: Flora Manto covers Zones 1 and 5, Leny Pacifico covers 20A and 20B.
 * So the link lives on the zone, and a BHW's areas are simply the zones
 * pointing at her.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bhws', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('contact_number', 20)->nullable();
            /*
             * Retired rather than deleted.
             *
             * A BHW who leaves still conducted the census visits already on
             * the register, and deleting her would orphan that history. She
             * stops being offered for new assignments instead.
             */
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('name');
        });

        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            /* "Zone 6A". Unique: two zones with one name is two different
               places the register cannot tell apart. */
            $table->string('name', 40)->unique();
            /*
             * Where it sits in the list, worked out from the name.
             *
             * Sorting by name alone puts Zone 10 between Zone 1 and Zone 2,
             * and a purok list in that order is one an office cannot read.
             * The number and any letter suffix are folded into one integer
             * when the zone is saved — see Zone::orderFor().
             */
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('bhw_id')->nullable()->constrained('bhws')->nullOnDelete();
            /* A zone merged into another stops being offered, but the
               residents already recorded in it keep reading correctly. */
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zones');
        Schema::dropIfExists('bhws');
    }
};
