<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->text('evidence_paths')->nullable()->after('id_path');
        });
    }

    public function down(): void
    {
        Schema::table('vawc_online_reports', function (Blueprint $table) {
            $table->dropColumn('evidence_paths');
        });
    }
};

