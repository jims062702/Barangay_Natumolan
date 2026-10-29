<?php

use App\Models\Household\Household;
use App\Models\Resident\Resident;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Household::whereNull('household_head_id')->chunkById(100, function ($households) {
            foreach ($households as $household) {
                $residents = Resident::where('household_id', $household->id)
                    ->whereNull('merged_into_id')
                    ->get();

                if ($residents->isEmpty()) {
                    continue;
                }

                $head = $residents->first(function ($r) {
                    return $r->birthdate && $r->birthdate->age >= 18;
                }) ?? $residents->first();

                if ($head) {
                    $household->handOverTo($head);
                }
            }
        });
    }

    public function down(): void
    {
        // Intentionally empty
    }
};
