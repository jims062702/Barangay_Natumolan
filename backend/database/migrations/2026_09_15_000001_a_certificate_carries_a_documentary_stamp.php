<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The documentary stamp the barangay affixes to every certificate.
 *
 * ₱30 on top of the certificate's own fee. It is the barangay that puts the
 * stamp on the paper; the system only has to charge for it and say so.
 *
 * WHY ITS OWN COLUMN, and not simply thirty pesos added to the fee. The fee is
 * set by the ordinance and the stamp is not; they are different money and a
 * report that cannot tell them apart cannot say how much of a day's takings
 * was stamps. And the amount can change: kept per certificate, a certificate
 * issued at ₱30 still reads ₱30 after the stamp goes up, which is what was
 * actually paid.
 *
 * Existing certificates are left at 0 — they were issued, and paid for,
 * before the stamp was charged, and backdating it would claim money nobody
 * collected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->decimal('documentary_stamp', 8, 2)->default(0)->after('fee_amount');
        });
    }

    public function down(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->dropColumn('documentary_stamp');
        });
    }
};
