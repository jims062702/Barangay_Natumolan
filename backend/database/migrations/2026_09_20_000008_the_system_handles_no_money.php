<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The barangay takes the money at the counter; this system does not count it.
 *
 * `lupon_payments` held an amount, a documentary-stamp amount and a receipt
 * number — a cash book. The system never touched a peso: somebody paid the
 * Clerk, and the Clerk typed the figure in afterwards. A second record of
 * money that is kept by hand elsewhere is a record that disagrees with the
 * real one, and the day it disagrees is the day somebody is accused.
 *
 * What survives is the only thing the Lupon actually reads: PAID OR NOT. The
 * summons is blocked until the filing fee is settled, and that is a yes/no.
 *
 * The row stays rather than becoming a flag on the case, because "asked for,
 * and by whom, and when" is worth keeping — a complainant sent to pay and
 * then turned away needs the record to explain why.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lupon_payments', function (Blueprint $table) {
            foreach (['amount', 'stamp_amount', 'receipt_no'] as $column) {
                if (Schema::hasColumn('lupon_payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('lupon_payments', function (Blueprint $table) {
            $table->decimal('amount', 8, 2)->default(0);
            $table->decimal('stamp_amount', 8, 2)->default(0);
            $table->string('receipt_no', 40)->nullable();
        });
    }
};
