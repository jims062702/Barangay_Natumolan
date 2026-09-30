<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * WHEN A CARD WAS ISSUED STAYS WHEN IT WAS ISSUED.
 *
 * resident_cards.issued_at was created as the table's first NOT NULL
 * TIMESTAMP, and MariaDB (explicit_defaults_for_timestamp off) quietly gives
 * that column DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP. So every
 * UPDATE of a card — revoking it, the card-history backfill — rewrote its
 * issue date with the database's clock, which is Manila time while the app
 * writes UTC: a card issued on the 28th read as issued on the 29th, eight
 * hours off, and a revoked card's history showed it issued after its
 * replacement.
 *
 * The column now has no default and no ON UPDATE; the app always sets it.
 * And the dates already rewritten are put back: a card is only ever written
 * once by the app, at issue — issued_at and created_at are set together —
 * so where the two now differ, created_at is the true issue time.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE resident_cards MODIFY issued_at TIMESTAMP NULL DEFAULT NULL');

        DB::statement(
            'UPDATE resident_cards SET issued_at = created_at
              WHERE created_at IS NOT NULL
                AND ABS(TIMESTAMPDIFF(SECOND, issued_at, created_at)) > 5'
        );
    }

    public function down(): void
    {
        /* Nothing to undo: putting the ON UPDATE back would only bring the bug back. */
    }
};
