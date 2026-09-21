<?php

namespace Database\Seeders;

use App\Models\Population\Bhw;
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

    /**
     * Who covers what. A BHW may hold more than one zone.
     *
     * ZONE 21C IS NOT HERE, and that is not an omission in this file — no
     * BHW was named for it. It is seeded unassigned so the office can see
     * the gap and fill it, rather than having it quietly attached to whoever
     * happened to be next in the list.
     */
    private const ASSIGNMENTS = [
        'FLORA G. MANTO' => ['Zone 1', 'Zone 5'],
        'CHERLIE B. LABIAL' => ['Zone 2'],
        'MARILIE B. AJON' => ['Zone 3'],
        'ROWENA TADEO' => ['Zone 4'],
        'ANNABELLE INDINO' => ['Zone 6A'],
        'GEMMA M. TACBOBO' => ['Zone 7', 'Zone 8'],
        'MAY ELEN GERONIMO' => ['Zone 9', 'Zone 10'],
        'MARIA FE E. FERNANDEZ' => ['Zone 11'],
        'MICHELLE C. DACLAG' => ['Zone 12', 'Zone 13'],
        'JOSEPHINE VALDEHUESA' => ['Zone 14'],
        'RHEA RODESSA A. MACABALE' => ['Zone 15', 'Zone 16'],
        'JULIET M. DAGANDAN' => ['Zone 17'],
        'ROMAYLE B. AQUIT' => ['Zone 18A'],
        'JENNYLYN C. BAIRAN' => ['Zone 18B'],
        'CHONA B. CABANDAY' => ['Zone 19'],
        'LENY B. PACIFICO' => ['Zone 20A', 'Zone 20B'],
        'RUSAMBRITCHE C. LOMOPOG' => ['Zone 21A'],
        'INGRID L. BONGOLTO' => ['Zone 21B'],
    ];

    public function run(): void
    {
        foreach (self::ZONES as $name) {
            /* sort_order is filled in by the model from the name. */
            Zone::firstOrCreate(['name' => $name], ['is_active' => true]);
        }

        foreach (self::ASSIGNMENTS as $bhwName => $zoneNames) {
            $bhw = Bhw::firstOrCreate(['name' => $bhwName], ['is_active' => true]);

            foreach ($zoneNames as $zoneName) {
                $zone = Zone::where('name', $zoneName)->first();

                /* Only where nobody is assigned yet. A zone the office has
                   since moved to somebody else stays where they put it. */
                if ($zone && $zone->bhw_id === null) {
                    $zone->forceFill(['bhw_id' => $bhw->id])->save();
                }
            }
        }
    }
}
