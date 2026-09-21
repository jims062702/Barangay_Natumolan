<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Animal bites — a REFERRAL register, and deliberately nothing more.
 *
 * A barangay health station does not treat rabies exposure. The vaccine
 * series is given at an Animal Bite Treatment Centre, and the only useful
 * thing the station can do is send the person there the same day and keep a
 * note that it did. So this table records the sending, not a course of
 * treatment: there is no dose schedule here and no outcome field to tempt
 * anybody into managing the case locally.
 *
 * What it does keep is what the centre will ask and what the barangay may
 * later need: when and where it happened, what bit them, whether the animal
 * is known and observable, and whether the person actually went.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animal_bite_referrals', function (Blueprint $table) {
            $table->id();

            /* The person bitten. On the register, because a referral names
               somebody the barangay can identify. */
            $table->foreignId('patient_id')->constrained('residents')->cascadeOnDelete();

            $table->date('bite_date');
            $table->time('bite_time')->nullable();
            $table->string('place_of_incident')->nullable();

            /* Dog by a wide margin, but cats and monkeys carry rabies too. */
            $table->string('animal', 40);
            /*
             * Whether the animal can be watched for ten days.
             *
             * The question that decides urgency more than any other: an
             * unknown stray means the series starts now and does not stop.
             */
            $table->enum('animal_status', ['Owned', 'Stray', 'Unknown'])->default('Unknown');
            $table->boolean('animal_vaccinated')->nullable();

            /* Category I/II/III in the national guideline — it decides what
               the centre gives. Kept as typed words so a station that has not
               been trained on the categories can still describe the wound. */
            $table->string('exposure_category', 20)->nullable();
            $table->text('wound_description')->nullable();
            /* Washing the wound with soap and running water is the one thing
               the station does do, and it matters. */
            $table->boolean('wound_washed')->default(false);

            $table->string('referred_to');
            $table->date('referred_on');
            $table->foreignId('referred_by')->nullable()->constrained('users')->nullOnDelete();
            /* Whether they went. Blank until somebody finds out, which is
               not the same as "no". */
            $table->boolean('attended')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            /* The two questions the register is read by: who, and when. */
            $table->index('patient_id');
            $table->index('bite_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animal_bite_referrals');
    }
};
