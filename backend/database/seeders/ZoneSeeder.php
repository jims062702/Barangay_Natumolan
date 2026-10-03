<?php

namespace Database\Seeders;

use App\Models\Population\Zone;
use Illuminate\Database\Seeder;

/**
 * Barangay Natumolan's twenty-five zones, and the BHW covering each.
 *
 * As given by the Population Office on 17 September 2026. The office can
 * change any of it from Zones & BHWs afterwards — this only puts the list
 * there in the first place.
 *
 * SAFE TO RUN AGAIN. Everything is matched by name and updated rather than
 * inserted, so re-seeding does not double the list. It deliberately does NOT
 * reset an assignment the office has since changed: a zone that already
 * exists keeps the BHW it has, because the office's later decision is better
 * information than this file.
 */
class ZoneSeeder extends Seeder
{
    /**
     * Every zone, in the order the office lists them.
     *
     * Zone 6 exists only as 6A, and 18, 20 and 21 are split — that is how
     * the barangay is laid out, not a typo.
     */
    private const ZONES = [
        'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6A',
        'Zone 7', 'Zone 8', 'Zone 9', 'Zone 10', 'Zone 11', 'Zone 12',
        'Zone 13', 'Zone 14', 'Zone 15', 'Zone 16', 'Zone 17',
        'Zone 18A', 'Zone 18B', 'Zone 19', 'Zone 20A', 'Zone 20B',
        'Zone 21A', 'Zone 21B', 'Zone 21C',
    ];

    public function run(): void
    {
        foreach (self::ZONES as $name) {
            /* sort_order is filled in by the model from the name. */
            Zone::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }
}
