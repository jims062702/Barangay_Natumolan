<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A fee a Lupon case owes, asked for by the Lupon and collected by the Clerk.
 *
 * The two offices do different halves of one job. The Lupon knows a case has
 * reached the point where money is due — filed, or going to a Certificate to
 * File Action — and the Clerk is the one who takes it. Neither can do the
 * other's part, and until now there was nowhere for the request to live in
 * between, so it travelled on paper or not at all.
 *
 * TWO KINDS:
 *   Filing   ₱20, before the Lupon issues a summons. Nothing moves until it
 *            is paid — that is the rule, and the summons is blocked on it.
 *   CFA      ₱200 plus a ₱30 documentary stamp, when conciliation has failed
 *            and the complainant takes the matter to court.
 *
 * THE STAMP IS ITS OWN COLUMN. It is not part of the fee: the barangay keeps
 * the ₱200 and the ₱30 buys a stamp that goes on the certificate. A single
 * total would make the two indistinguishable on a report, and they are
 * accounted for separately.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lupon_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lupon_case_id')->constrained('lupon_cases')->cascadeOnDelete();
            $table->enum('kind', ['Filing', 'CFA']);
            /* What the barangay keeps. */
            $table->decimal('amount', 8, 2);
            /* What buys the documentary stamp. Zero on a filing fee. */
            $table->decimal('stamp_amount', 8, 2)->default(0);
            $table->enum('status', ['Requested', 'Paid', 'Cancelled'])->default('Requested');

            /* Who asked, from the Lupon. */
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('requested_at')->nullable();

            /* Who took the money, at the counter. */
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            /* The official receipt the payer walks away with. */
            $table->string('receipt_no', 40)->nullable();

            $table->string('notes', 255)->nullable();
            $table->timestamps();

            /* The Clerk's worklist is "what is still owed", oldest first. */
            $table->index(['status', 'requested_at']);
            /*
             * One live request per kind per case.
             *
             * Without it, two clicks on "Ask the Clerk for the filing fee"
             * put the same ₱20 on the counter twice, and the second one is
             * a payment the complainant does not owe. A CANCELLED one is
             * excluded, so a request withdrawn in error can be made again.
             */
            $table->index(['lupon_case_id', 'kind', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lupon_payments');
    }
};
