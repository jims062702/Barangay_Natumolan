<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sign-in tokens name their owner "user", not a class path.
 *
 * Every token row recorded who it belongs to as the PHP class
 * "App\Models\User". The models now live in folders, so that class is
 * App\Models\Account\User — and a token pointing at a class that no longer
 * exists signs nobody in. AppServiceProvider maps the short alias "user" to
 * the model; this rewrites the rows already there to match.
 *
 * The alias also means the next move of the model touches one line in the
 * provider and no rows at all.
 */
return new class extends Migration
{
    private const OLD = 'App\\Models\\User';

    private const ALIAS = 'user';

    public function up(): void
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_type', self::OLD)
            ->update(['tokenable_type' => self::ALIAS]);
    }

    public function down(): void
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_type', self::ALIAS)
            ->update(['tokenable_type' => self::OLD]);
    }
};
