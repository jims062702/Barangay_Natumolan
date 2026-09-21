<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The one session a VAWC case gets, and what was agreed at it.
 *
 * ONE PER CASE — the unique key below is the rule, not a convention. The
 * barangay VAWC desk sits the parties down ONCE to hear what happened and
 * record what was agreed; it is not a mediation series, and a desk that can
 * schedule a second and a third is a desk that has started mediating, which
 * for a VAWC matter is prohibited. Making it impossible in the schema is the
 * only place that rule cannot be worked around by a busy afternoon.
 *
 * ENCRYPTED, like the rest of this desk. What was discussed and what was
 * agreed name people and describe what happened to them, so they are stored
 * the same way the case narrative is — with a key the browser never holds.
 * They are never cached, never queued, and never travel in a consolidated
 * report.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vawc_agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vawc_case_id')->constrained('vawc_cases')->cascadeOnDelete();

            $table->date('session_date');
            /* Who actually sat down. Free text: a support person or a barangay
               official may attend, and the desk should be able to say so. */
            $table->text('attendees')->nullable();

            /* What was said. The record of the session itself. */
            $table->text('discussion')->nullable();
            /* What was agreed, in the parties' own terms. */
            $table->text('agreement')->nullable();

            /*
             * Acknowledged rather than "signed".
             *
             * The paper carries the signatures; this records that the desk saw
             * each party acknowledge the agreement. Claiming to hold a
             * signature we do not hold would be worse than holding nothing.
             */
            $table->boolean('survivor_acknowledged')->default(false);
            $table->boolean('respondent_acknowledged')->default(false);

            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            /* One session, one agreement, one case. */
            $table->unique('vawc_case_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vawc_agreements');
    }
};
