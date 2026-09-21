<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The register records sex as Male or Female.
 *
 * The column carried a third value, "Other", which no record in the register
 * has ever held — 3,283 residents, none of them. It was offered on four
 * forms, counted in the population charts as a bar that is always zero, and
 * reported to DILG as a column nobody fills.
 *
 * SAFE BECAUSE IT IS EMPTY. Narrowing an ENUM that still held rows would
 * turn each of them into an empty string — a resident whose sex quietly
 * becomes blank. The check below refuses rather than does that, so if this
 * ever runs somewhere the value HAS been used, it stops and says so.
 */
return new class extends Migration
{
    private const TWO = "enum('Male','Female')";
    private const THREE = "enum('Male','Female','Other')";

    public function up(): void
    {
        $others = DB::table('residents')->where('gender', 'Other')->count();

        if ($others > 0) {
            throw new RuntimeException(
                "Cannot narrow: {$others} resident(s) are recorded as 'Other' and that value "
                . 'would be erased. Set them to Male or Female first.'
            );
        }

        DB::statement('ALTER TABLE residents MODIFY gender ' . self::TWO . ' NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE residents MODIFY gender ' . self::THREE . ' NULL');
    }
};
