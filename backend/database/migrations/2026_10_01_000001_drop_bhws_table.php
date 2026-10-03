<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('zones', 'bhw_id')) {
            Schema::table('zones', function (Blueprint $table) {
                $table->dropForeign(['bhw_id']);
                $table->dropColumn('bhw_id');
            });
        }

        Schema::dropIfExists('bhws');
    }

    public function down(): void
    {
        Schema::create('bhws', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('contact_number', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('zones', function (Blueprint $table) {
            $table->foreignId('bhw_id')->nullable()->constrained('bhws')->nullOnDelete();
        });
    }
};
