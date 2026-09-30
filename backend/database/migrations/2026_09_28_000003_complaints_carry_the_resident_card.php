<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Which Barangay Resident ID a resident's online complaint was verified by.
 *
 * A resident filing online is identified by their card — its QR checked
 * against the register — and not by a name and a birthday typed into a
 * form. The card is kept on the complaint so the office can see what
 * identified the filer, even after that card is replaced.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_complaints', function (Blueprint $table) {
            $table->foreignId('resident_card_id')->nullable()->after('resident_id')
                ->constrained('resident_cards')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('online_complaints', function (Blueprint $table) {
            $table->dropConstrainedForeignId('resident_card_id');
        });
    }
};
