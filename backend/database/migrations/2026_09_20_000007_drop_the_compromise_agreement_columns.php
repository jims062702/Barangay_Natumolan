<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The Compromise Agreement goes the same way as the Certificate to File
 * Action, and for the same reason: this Lupon no longer issues one.
 *
 * Dropped rather than left unwritten. A column that still exists is a column
 * somebody reads a year from now and believes — and `cba_issued` defaulting
 * to 0 reads as "no compromise agreement was issued", which is a statement
 * about a document that is no longer part of the process at all.
 *
 * Refuses if anything used it, for the same reason the migration before this
 * one refuses: a person should decide what those records say, not a schema
 * change made in the dark.
 */
return new class extends Migration
{
    public function up(): void
    {
        $issued = DB::table('lupon_settlements')->where('cba_issued', 1)->count();

        if ($issued > 0) {
            throw new RuntimeException(
                "Refusing to drop the compromise-agreement columns: {$issued} settlement(s) "
                    . 'record one as issued. Decide what those should say first.'
            );
        }

        Schema::table('lupon_settlements', function (Blueprint $table) {
            foreach (['cba_issued', 'cba_issued_at'] as $column) {
                if (Schema::hasColumn('lupon_settlements', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('lupon_settlements', function (Blueprint $table) {
            $table->boolean('cba_issued')->default(false);
            $table->timestamp('cba_issued_at')->nullable();
        });
    }
};
