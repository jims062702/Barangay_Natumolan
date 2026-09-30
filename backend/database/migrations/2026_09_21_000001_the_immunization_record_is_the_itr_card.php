<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The immunization record becomes what the DOH Individual Treatment Record
 * says it is: a CARD per person.
 *
 * The ITR's "Immunization Record" column has two kinds of line. Four describe
 * the person once — newborn screening, type of delivery, birth weight, birth
 * length — and the rest are one blank per vaccine for the date it was given.
 * The doses already live in `immunization_records`, one row each, which is
 * right: every dose has its own date. The once-per-person facts had nowhere
 * to go, so they get `immunization_profiles`, one row per resident.
 *
 * "Others" and "Booster" are free lines on the paper form and stay free text
 * here.
 *
 * And three columns come OFF `immunization_records`: height, weight and
 * temperature. They were added to hold vital signs taken at the jab — but
 * they are not on the ITR's immunization record (they belong to the
 * consultation block, where `health_visits` already keeps them), and they
 * were never accepted by the request that writes a dose, so nothing ever
 * filled them. Refuses to drop them if a single row does hold a value.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('immunization_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resident_id')->unique()->constrained('residents')->cascadeOnDelete();

            /* A date, because that is what goes in the blank: when the heel
               prick was done. Null is "not recorded", not "not done". */
            $table->date('newborn_screening_date')->nullable();
            $table->enum('delivery_type', ['NSVD', 'Cesarian'])->nullable();
            /* The form prints KG and CM. A newborn is weighed to the gram and
               measured to the millimetre, so neither is a whole number. */
            $table->decimal('birth_weight_kg', 4, 2)->nullable();
            $table->decimal('birth_length_cm', 4, 1)->nullable();

            $table->text('others')->nullable();
            $table->text('booster')->nullable();

            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $filled = DB::table('immunization_records')
            ->where(fn ($q) => $q->whereNotNull('height_cm')
                ->orWhereNotNull('weight_kg')
                ->orWhereNotNull('temperature'))
            ->count();

        if ($filled > 0) {
            throw new RuntimeException(
                "Refusing to drop height/weight/temperature from immunization_records: "
                    . "{$filled} row(s) hold a value. Move those readings first."
            );
        }

        Schema::table('immunization_records', function (Blueprint $table) {
            foreach (['height_cm', 'weight_kg', 'temperature'] as $column) {
                if (Schema::hasColumn('immunization_records', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('immunization_records', function (Blueprint $table) {
            $table->decimal('height_cm', 5, 1)->nullable()->after('vaccination_date');
            $table->decimal('weight_kg', 5, 2)->nullable()->after('height_cm');
            $table->decimal('temperature', 4, 1)->nullable()->after('weight_kg');
        });

        Schema::dropIfExists('immunization_profiles');
    }
};
