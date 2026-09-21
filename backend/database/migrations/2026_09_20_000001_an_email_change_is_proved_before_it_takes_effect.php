<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An address somebody has asked to move to, but has not yet proved is theirs.
 *
 * Changing `email` directly would hand the account to whatever was typed: a
 * typo locks the owner out of their own portal, and a deliberate wrong
 * address hands a stranger the password-reset route. So the new address waits
 * here until a code sent TO IT comes back, and only then becomes the login.
 *
 * The live `email` is untouched for the whole of that wait, which is the
 * point — a change that is never confirmed changes nothing at all.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pending_email')->nullable()->after('email');
        });

        /*
         * Not unique.
         *
         * Two people may both have TYPED the same address without either
         * having proved it; only the one who answers the code gets it, and
         * `users.email` is unique, which is where the collision actually
         * matters. A unique index here would instead let one person block
         * another from even attempting their own address.
         */
        Schema::table('users', function (Blueprint $table) {
            $table->index('pending_email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['pending_email']);
            $table->dropColumn('pending_email');
        });
    }
};
