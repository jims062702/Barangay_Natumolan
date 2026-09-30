<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A notification can say where it leads.
 *
 * "Your case is in your Lupon Records" with nothing to press is a notice the
 * resident then has to go and find. The page a notice is about is known when
 * it is written — Cases I Filed or Cases Against Me depends on which side the
 * reader is on — so it is stored with it, and the bell opens it.
 *
 * Nullable: every notice already written leads nowhere, and still reads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('link', 255)->nullable()->after('related_entity_id');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('link');
        });
    }
};
