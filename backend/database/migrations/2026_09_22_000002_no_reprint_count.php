<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The reprint counter goes with the "Log reprint" button.
 *
 * The office asked for the button to be removed. With it gone nothing adds to
 * the count and nothing shows it, so the column would only be a number that
 * is always what it was the day the button disappeared. Every certificate on
 * the register read 0 when it was dropped.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->dropColumn('reprint_count');
        });
    }

    public function down(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->unsignedInteger('reprint_count')->default(0);
        });
    }
};
