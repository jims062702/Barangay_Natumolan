<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * No more pending pre-registrations.
 *
 * A complaint filed online by somebody who said they live here, and whom the
 * register could not find, used to become a "pending resident" the
 * Population Office later linked to a census record — and the complaint
 * waited on it. The register is now the one door onto the register: the
 * online form asks such a filer to be registered at the Population Office
 * first, as a certificate does. Nothing is waiting on a pending resident,
 * so the table and the column that pointed at it go.
 *
 * Refused if either still holds anything, rather than dropping it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pending_residents') && \Illuminate\Support\Facades\DB::table('pending_residents')->exists()) {
            throw new RuntimeException('pending_residents still has rows — link or decline them before this migration runs.');
        }
        if (Schema::hasColumn('online_complaints', 'pending_resident_id')
            && \Illuminate\Support\Facades\DB::table('online_complaints')->whereNotNull('pending_resident_id')->exists()) {
            throw new RuntimeException('Some online complaints still wait on a pending resident — resolve them first.');
        }

        Schema::table('online_complaints', function (Blueprint $table) {
            $table->dropForeign(['pending_resident_id']);
            $table->dropColumn('pending_resident_id');
        });

        Schema::dropIfExists('pending_residents');
    }

    /* Put back exactly as 2026_09_25_000003 made them. */
    public function down(): void
    {
        Schema::create('pending_residents', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->string('suffix', 20)->nullable();
            $table->string('address', 255);
            $table->string('zone_purok', 40)->nullable();
            $table->string('contact_number', 50)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('sex', 20)->nullable();
            $table->string('civil_status', 40)->nullable();
            $table->string('valid_id_type', 80)->nullable();
            $table->string('valid_id_number', 80)->nullable();
            $table->enum('status', ['Pending', 'Registered', 'Declined'])->default('Pending');
            $table->foreignId('resident_id')->nullable()->constrained('residents')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->string('notes', 255)->nullable();
            $table->timestamps();
            $table->index('status');
        });

        Schema::table('online_complaints', function (Blueprint $table) {
            $table->foreignId('pending_resident_id')->nullable()->after('resident_id')
                ->constrained('pending_residents')->nullOnDelete();
        });
    }
};
