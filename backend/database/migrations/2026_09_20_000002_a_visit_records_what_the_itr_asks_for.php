<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A consultation, as the Individual Treatment Record actually asks for it.
 *
 * The ITR is the DOH form the health station already fills in on paper. Its
 * consultation block asks for eleven vital signs; this table held four. The
 * missing ones are not optional extras — fundal height, fetal heart tone,
 * age of gestation and presentation are the whole of a prenatal check, and
 * without them a midwife writing on paper had nothing here to type into.
 *
 * The laboratory line is a LIST on the form — twelve tests with a tick beside
 * each — so it is stored as the ticked ones, newline separated, in the same
 * shape the immediate-needs list on the VAWC side uses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('health_visits', function (Blueprint $table) {
            /* The form asks for a TIME as well as a date: a station seeing
               forty people a day orders its own record by it. */
            $table->time('visit_time')->nullable()->after('visit_date');

            /* "Chief complaints" on the form. `visit_reason` above is the
               short label; this is what the patient actually said. */
            $table->text('chief_complaints')->nullable()->after('visit_reason');

            /* The rest of the vital signs the form asks for. Height and
               weight are decimals because the form prints "(cm)" and "(KG)"
               and a child's weight is not a whole number of kilos. */
            $table->unsignedSmallInteger('respiratory_rate')->nullable()->after('heart_rate');
            $table->unsignedTinyInteger('oxygen_saturation')->nullable()->after('respiratory_rate');
            $table->decimal('height_cm', 5, 1)->nullable()->after('oxygen_saturation');
            $table->decimal('weight_kg', 5, 2)->nullable()->after('height_cm');

            /*
             * The prenatal half of the block.
             *
             * Nullable and blank for most visits — a man with a cough has no
             * fundal height — but for a pregnant woman these four ARE the
             * examination, and the form gives them equal billing.
             */
            $table->decimal('fundal_height_cm', 5, 1)->nullable()->after('weight_kg');
            $table->unsignedSmallInteger('fetal_heart_tone')->nullable()->after('fundal_height_cm');
            $table->string('age_of_gestation', 30)->nullable()->after('fetal_heart_tone');
            $table->string('presentation', 60)->nullable()->after('age_of_gestation');

            /* "Medication/treatment" — its own box on the form, and not the
               same thing as the advice given afterwards. */
            $table->text('medication')->nullable()->after('consultation_notes');

            /* The ticked tests, one per line. */
            $table->text('laboratory')->nullable()->after('medication');
        });
    }

    public function down(): void
    {
        Schema::table('health_visits', function (Blueprint $table) {
            $table->dropColumn([
                'visit_time', 'chief_complaints', 'respiratory_rate', 'oxygen_saturation',
                'height_cm', 'weight_kg', 'fundal_height_cm', 'fetal_heart_tone',
                'age_of_gestation', 'presentation', 'medication', 'laboratory',
            ]);
        });
    }
};
