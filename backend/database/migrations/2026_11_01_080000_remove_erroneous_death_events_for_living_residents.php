<?php

use App\Models\Population\Event;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Delete any death events where the resident is alive (recorded in error)
        Event::where('event_type', 'Death')
            ->whereHas('resident', function ($q) {
                $q->where('life_status', '!=', 'Deceased');
            })
            ->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};

