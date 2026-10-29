<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE lupon_cases MODIFY case_number VARCHAR(255) NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE lupon_cases MODIFY case_number VARCHAR(255) NOT NULL');
    }
};

