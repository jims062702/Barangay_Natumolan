<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE vawc_agreements MODIFY outcome VARCHAR(50) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE vawc_agreements MODIFY outcome ENUM('Agreement reached', 'No agreement') NULL");
    }
};
