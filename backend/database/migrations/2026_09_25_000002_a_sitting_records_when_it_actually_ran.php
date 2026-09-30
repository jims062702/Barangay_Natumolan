<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WHEN THE SITTING ACTUALLY RAN, beside when it was set to.
 *
 * `scheduled_at` is an appointment: the hour on the summons, the hour the
 * parties are told to come. It is not a record of the hearing. A sitting
 * booked for 9:00 may begin at 9:20 because a party was late and run to
 * 11:00 because the dispute needed it — and the barangay has no business
 * cutting a mediation short because a slot ran out.
 *
 * So the ninety minutes are a DEFAULT for laying out the day, never a
 * deadline: nothing ends, cancels or completes a hearing when they expire.
 * These two columns hold what happened, and the difference between them and
 * the appointment is what tells the office the day is running late.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lupon_hearings', function (Blueprint $table) {
            $table->dateTime('started_at')->nullable()->after('scheduled_at');
            $table->dateTime('ended_at')->nullable()->after('started_at');
        });
    }

    public function down(): void
    {
        Schema::table('lupon_hearings', function (Blueprint $table) {
            $table->dropColumn(['started_at', 'ended_at']);
        });
    }
};
