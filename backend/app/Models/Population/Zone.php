<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One zone of the barangay, and the health worker who covers it.
 */
class Zone extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'sort_order', 'bhw_id', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function bhw(): BelongsTo
    {
        return $this->belongsTo(Bhw::class);
    }

    /**
     * Where a zone sits in the list, worked out from its name.
     *
     * Zone names are a number and sometimes a letter — "Zone 7", "Zone 18A",
     * "Zone 21C" — and sorting those as text puts Zone 10 between Zone 1 and
     * Zone 2. So the number and the letter are folded into one integer:
     *
     *     Zone 6A   ->  6 * 100 + 1  =  601
     *     Zone 7    ->  7 * 100 + 0  =  700
     *     Zone 18B  -> 18 * 100 + 2  = 1802
     *
     * The letter is worth less than a whole zone, so 18A and 18B stay
     * together and both sit between 17 and 19.
     *
     * A name that is not "Zone <number><letter>" sorts to the END rather
     * than to the front: the office may one day name a place something else
     * entirely, and an unrecognised name should not silently displace the
     * numbered ones.
     */
    public static function orderFor(string $name): int
    {
        if (preg_match('/(\d+)\s*([A-Za-z]?)/', $name, $found) !== 1) {
            return 999999;
        }

        $number = (int) $found[1];
        $letter = $found[2] === '' ? 0 : ord(strtoupper($found[2])) - ord('A') + 1;

        return $number * 100 + $letter;
    }

    /**
     * Keeps sort_order true to the name, whoever sets it.
     *
     * In the model rather than in the controller, so a zone created by a
     * seeder, a console command or a future screen is ordered the same way
     * as one typed in by the office.
     */
    protected static function booted(): void
    {
        static::saving(function (self $zone) {
            if ($zone->isDirty('name')) {
                $zone->sort_order = self::orderFor($zone->name);
            }
        });
    }

    /** The list an office reads: in order, and still in use. */
    public function scopeInOrder($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }
}
