<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A request the resident asked for by mistake.
 *
 * There was no way to take one back. A resident who tapped the wrong
 * certificate, or asked twice because the first one seemed not to have sent,
 * left a request standing that the office would work on — and the only way
 * out was to walk to the barangay and ask a clerk to reject it, which files
 * it under the office's refusal rather than the resident's change of mind.
 *
 * 'Cancelled' is the resident's own word for it, and it is deliberately NOT
 * 'Rejected': the office refusing a request and a resident withdrawing one
 * are different events, and a register that cannot tell them apart cannot
 * answer how often either happens.
 *
 * Withdrawn, never deleted. The request keeps its number and its place in
 * the series, so a resident who changes their mind again can put it back —
 * and so the office's record of what was asked for stays whole. Nothing in
 * this system lets a resident remove a row.
 */
return new class extends Migration
{
    public function up(): void
    {
        /*
         * Raw, because Doctrine DBAL is not installed and Laravel cannot
         * alter an enum without it. The list is the existing one plus the
         * new value — spelled out in full, because MODIFY replaces the
         * definition rather than adding to it, and dropping a value here
         * would silently blank every row already holding it.
         */
        DB::statement(
            "ALTER TABLE service_requests MODIFY status
             ENUM('Pending', 'In Progress', 'Approved', 'Completed', 'Rejected', 'Cancelled')
             NOT NULL DEFAULT 'Pending'"
        );
    }

    public function down(): void
    {
        /*
         * Anything cancelled goes back to Pending before the value is
         * removed. Without this the ALTER truncates those rows to an empty
         * status — MySQL's way of handling a value that no longer exists —
         * and the request becomes one nothing can act on or explain.
         */
        DB::table('service_requests')->where('status', 'Cancelled')->update(['status' => 'Pending']);

        DB::statement(
            "ALTER TABLE service_requests MODIFY status
             ENUM('Pending', 'In Progress', 'Approved', 'Completed', 'Rejected')
             NOT NULL DEFAULT 'Pending'"
        );
    }
};
