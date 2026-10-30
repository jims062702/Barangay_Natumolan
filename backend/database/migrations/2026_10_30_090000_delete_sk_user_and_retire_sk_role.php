<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Delete SK users and their tokens/notifications
        $skUserIds = DB::table('users')
            ->where('email', 'sk@natumolan.local')
            ->orWhere('office', 'SK')
            ->orWhereIn('role', ['SK Chairperson', 'SK Kagawad', 'SK Secretary'])
            ->pluck('id');

        if ($skUserIds->isNotEmpty()) {
            DB::table('personal_access_tokens')->whereIn('tokenable_id', $skUserIds)->delete();
            DB::table('notifications')->whereIn('user_id', $skUserIds)->delete();
            DB::table('users')->whereIn('id', $skUserIds)->delete();
        }

        // 2. Adjust role and office enums on users table
        try {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('Punong Barangay','Secretary','Clerk','VAWC Officer','Lupon Secretary','Population Worker','Health Personnel','Admin','Resident') NOT NULL DEFAULT 'Clerk'");
            DB::statement("ALTER TABLE users MODIFY COLUMN office ENUM('Main Office','VAWC','Lupon','Population','Health Station','Admin','Resident') NOT NULL DEFAULT 'Main Office'");
        } catch (\Throwable $e) {
            // If DB engine restricts enum alteration without dropping, keep existing enum safely
        }
    }

    public function down(): void
    {
    }
};
