<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The two running lists the station keeps by hand.
 *
 * Both are DAY REGISTERS, not case files. `maternal_health` already holds the
 * pregnancy — registration date, expected delivery, risk indicators — and is
 * one row per pregnancy. What the midwife writes at the table is one line per
 * visit: who came, how old she is, where she lives, and what she complained
 * of. Those are different records and forcing them into one loses the
 * sequence, which is the whole value of the list.
 *
 * The senior list is the same shape and shorter still: a name, an age and a
 * blood pressure, taken at the monthly check. Nothing else was asked for and
 * nothing else is stored — a column nobody fills is a column that makes the
 * form longer and the record no better.
 *
 * Both point at the register rather than repeating a name, so a woman who
 * marries or moves is not two people here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prenatal_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mother_id')->constrained('residents')->cascadeOnDelete();
            $table->date('visit_date');
            /*
             * Age AS RECORDED ON THE DAY.
             *
             * Derivable from the birthdate, and stored anyway: the list is
             * read back as a historical record, and "she was 17 at this
             * visit" is the fact that mattered then. Recomputing it from
             * today's date would silently rewrite every old line.
             */
            $table->unsignedTinyInteger('age')->nullable();
            /* Where she lives, on the day. Same reason. */
            $table->string('zone_purok', 60)->nullable();
            $table->string('contact_number', 30)->nullable();
            $table->text('complaint')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('visit_date');
            $table->index('mother_id');
        });

        Schema::create('senior_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('senior_id')->constrained('residents')->cascadeOnDelete();
            $table->date('check_date');
            $table->unsignedTinyInteger('age')->nullable();
            /*
             * "120/80" — one string, not two numbers.
             *
             * It is read, written and said as one reading; splitting it into
             * systolic and diastolic would make every form two boxes and
             * every list a concatenation, for no question anybody asks.
             */
            $table->string('blood_pressure', 20)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('check_date');
            $table->index('senior_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('senior_checks');
        Schema::dropIfExists('prenatal_visits');
    }
};
