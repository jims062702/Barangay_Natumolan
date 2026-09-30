<?php

use App\Support\ManilaTime;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * THE FILING FEE HAS THREE CALENDAR DAYS (the office's rule, 2026-09-28).
 *
 * A case waiting on its filing fee now carries, beside its stage:
 *
 *   payment_status        Unpaid, Paid or Overdue — the FEE's state, kept
 *                         apart from the case's stage on purpose
 *   payment_required_at   when the fee was required (the case was filed)
 *   payment_due_at        the end of the third calendar day after that,
 *                         in Manila
 *   auto_closed_at        when the system closed it for the fee not paid
 *
 * and a new stage, "Closed — Unpaid", which is where a case goes when the
 * third day ends with the fee unpaid. Nothing is deleted: the case, its
 * complaint and its history stay, and lupon_case_events records why.
 *
 * CASES ALREADY WAITING get their three days from TODAY, not from when they
 * were filed (the office's decision): a rule nobody had been told about must
 * not close a case the moment it arrives.
 */
return new class extends Migration
{
    private const STAGES = "'Filed','For Summons','Mediation','For Lupon Summons','Conciliation','Settled','Dismissed','Referred','CFA','Withdrawn'";

    public function up(): void
    {
        DB::statement("ALTER TABLE lupon_cases MODIFY current_stage ENUM(" . self::STAGES . ",'Closed — Unpaid') NOT NULL DEFAULT 'Filed'");

        Schema::table('lupon_cases', function (Blueprint $table) {
            $table->string('payment_status', 12)->nullable()->after('current_stage');
            $table->dateTime('payment_required_at')->nullable()->after('payment_status');
            $table->dateTime('payment_due_at')->nullable()->after('payment_required_at');
            $table->dateTime('auto_closed_at')->nullable()->after('payment_due_at');
            $table->index(['current_stage', 'payment_status', 'payment_due_at'], 'lupon_cases_fee_deadline');
        });

        Schema::create('lupon_case_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lupon_case_id')->constrained('lupon_cases')->cascadeOnDelete();
            $table->string('event', 40);
            $table->string('detail', 255)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();
        });

        $now = now();
        $due = Carbon::now(ManilaTime::ZONE)->startOfDay()->addDays(3)->endOfDay()->utc();

        $paid = DB::table('lupon_payments')->where('kind', 'Filing')->where('status', 'Paid')->pluck('lupon_case_id');
        DB::table('lupon_cases')->whereIn('id', $paid)->update(['payment_status' => 'Paid']);

        $waiting = DB::table('lupon_cases')->where('current_stage', 'Filed')->whereNotIn('id', $paid)->pluck('id');
        foreach ($waiting as $id) {
            DB::table('lupon_cases')->where('id', $id)->update([
                'payment_status' => 'Unpaid',
                'payment_required_at' => $now,
                'payment_due_at' => $due,
            ]);
            DB::table('lupon_case_events')->insert([
                'lupon_case_id' => $id,
                'event' => 'fee_required',
                'detail' => 'The 3-day filing-fee rule began; pay by '
                    . $due->copy()->setTimezone(ManilaTime::ZONE)->format('M j, Y') . ' (end of day).',
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        /* A case closed for the fee goes back to waiting on it. */
        DB::table('lupon_cases')->where('current_stage', 'Closed — Unpaid')->update(['current_stage' => 'Filed']);
        DB::statement("ALTER TABLE lupon_cases MODIFY current_stage ENUM(" . self::STAGES . ") NOT NULL DEFAULT 'Filed'");

        Schema::dropIfExists('lupon_case_events');
        Schema::table('lupon_cases', function (Blueprint $table) {
            $table->dropIndex('lupon_cases_fee_deadline');
            $table->dropColumn(['payment_status', 'payment_required_at', 'payment_due_at', 'auto_closed_at']);
        });
    }
};
