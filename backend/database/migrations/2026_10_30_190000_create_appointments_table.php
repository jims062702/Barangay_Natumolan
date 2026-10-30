<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('appointment_number', 32)->unique();
            $table->foreignId('resident_id')->nullable()->constrained('residents')->nullOnDelete();
            $table->string('applicant_type', 20)->default('Resident'); // 'Resident' | 'Non-resident'
            $table->boolean('is_walk_in')->default(false);
            $table->string('full_name', 150);
            $table->text('address')->nullable();
            $table->string('phone_number', 25);
            $table->string('email', 100)->nullable();
            $table->date('appointment_date');
            $table->string('appointment_time', 20)->nullable(); // e.g. "09:30 AM"
            $table->text('purpose');
            $table->string('status', 20)->default('Pending'); // 'Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'
            $table->text('minutes')->nullable(); // Recorded by Secretary, read-only for PB
            $table->text('rejection_reason')->nullable();
            $table->string('id_card_code', 32)->nullable();
            $table->string('id_photo_path')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'appointment_date']);
            $table->index('resident_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
