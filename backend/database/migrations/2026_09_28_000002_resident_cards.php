<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * THE BARANGAY RESIDENT ID.
 *
 * One row per card ever issued. The card's QR carries a short random code —
 * never a name, a birthday or an address — and the code is kept here twice:
 *
 *   token_hash   a keyed hash, which is what a scanned or uploaded code is
 *                looked up by. A copy of this table (and the barangay's
 *                backups are copies) gives nobody a working code.
 *   token        the code itself, encrypted, so the resident's own digital
 *                card can be drawn again on their portal.
 *
 * A resident has at most one Active card. Issuing another revokes the one
 * before it — a lost card stops working the day its replacement is printed.
 * Nothing is ever deleted: which card was valid when is a matter of record.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resident_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resident_id')->constrained('residents')->restrictOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->text('token');
            $table->string('status', 12)->default('Active');
            $table->string('issued_via', 24);
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('issued_at');
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('revoke_reason', 255)->nullable();
            $table->timestamps();

            $table->index(['resident_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resident_cards');
    }
};
