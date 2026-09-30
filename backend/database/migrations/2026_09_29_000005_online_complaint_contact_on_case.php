<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * THE CONTACT NUMBER A COMPLAINANT GAVE ONLINE, ON THE CASE IT BECAME.
 *
 * Accepting an online complaint from a RESIDENT left the case's own contact
 * blank and relied on their register record — which usually has none, so
 * the docket showed no number although the complainant had typed one. The
 * case now keeps the number given for it (OnlineComplaintController::accept);
 * this puts it on the cases accepted before, where the case has none. The
 * portal's "Not on record" (it had no number to send) is not a number.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "UPDATE lupon_cases lc
               JOIN online_complaints oc ON oc.lupon_case_id = lc.id
                SET lc.complainant_contact = oc.complainant_contact
              WHERE (lc.complainant_contact IS NULL OR lc.complainant_contact = '')
                AND oc.complainant_contact IS NOT NULL
                AND oc.complainant_contact <> ''
                AND oc.complainant_contact <> 'Not on record'"
        );
    }

    public function down(): void
    {
        /* Nothing to undo: the number is the complainant's own, given for this case. */
    }
};
