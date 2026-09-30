<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ONE CASE, MORE THAN ONE KIND OF VIOLENCE — because that is the usual case.
 *
 * `violence_type` held exactly one word, and the intake form offered two of
 * them. A woman describing a beating, the threats that came with it and the
 * wages taken off her had to be filed as ONE of those things, and the desk
 * chose. Everything the other two would have counted went unrecorded: the
 * quarterly return under-reported, and the next officer reading the file saw
 * a narrower case than the one that walked in.
 *
 * `violence_types` is the list, and `violence_acts` the specific acts under
 * them the desk chose to note — optional, because a survivor recounting what
 * happened is not filling in a checklist, and an officer who cannot find the
 * exact act must still be able to record the kind.
 *
 * The old column STAYS, holding the first of the list, so the quarterly
 * forms and the case filter that read it keep working while they are moved
 * over. Nothing that was recorded is lost: each existing case becomes a list
 * of the one kind it already had.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->json('violence_types')->nullable()->after('violence_type');
            $table->json('violence_acts')->nullable()->after('violence_types');
        });

        /*
         * Every case already on the desk keeps exactly what it said.
         * "Mixed" is the one that cannot be carried over as itself — it was
         * the old way of saying "more than one" without saying which — so it
         * becomes an empty list rather than a kind nobody can act on.
         */
        foreach (DB::table('vawc_cases')->select('id', 'violence_type')->get() as $case) {
            DB::table('vawc_cases')->where('id', $case->id)->update([
                'violence_types' => json_encode(
                    $case->violence_type && $case->violence_type !== 'Mixed' ? [$case->violence_type] : []
                ),
                'violence_acts' => json_encode([]),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->dropColumn(['violence_types', 'violence_acts']);
        });
    }
};
