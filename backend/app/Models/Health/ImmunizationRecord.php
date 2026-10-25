<?php

namespace App\Models\Health;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Models\Resident\Resident;

/**
 * One dose, given on one day. A person's whole card is these rows plus their
 * ImmunizationProfile.
 */
class ImmunizationRecord extends Model
{
    /**
     * The vaccines on the DOH Individual Treatment Record, in the order the
     * form prints them.
     *
     * THE FORM IS THE LIST. A dose is recorded against one of these names or
     * not at all — the free-typed names this replaced ("Pentavalent (1st
     * dose)", "MMR") could not be matched back to the paper card or counted
     * against each other.
     *
     * Two groups because the form draws two: the childhood schedule down the
     * column, and "Adult immunization" boxed off beneath it.
     */
    public const CHILD_VACCINES = [
        'BCG',
        'Hep B within 24 hrs',
        'Hep B after 24 hrs',
        'Penta 1', 'Penta 2', 'Penta 3',
        'PCV 1', 'PCV 2', 'PCV 3',
        'OPV 1', 'OPV 2', 'OPV 3',
        'IPV',
        'MCV 1', 'MCV 2',
        'HPV 1', 'HPV 2',
    ];

    public const ADULT_VACCINES = [
        'Pneumococcal',
        'Flu vaccine',
        'COVID vaccine 1st dose',
        'COVID vaccine 2nd dose',
        'COVID booster',
        'Tetanus toxoid',
        'ATS',
    ];

    /** Every name a dose may be recorded under. */
    public static function vaccines(): array
    {
        return [...self::CHILD_VACCINES, ...self::ADULT_VACCINES];
    }

    protected $fillable = [
        'child_id',
        'vaccine_name',
        'vaccination_date',
        'scheduled_date',
        'lot_number',
        'administered_by',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'vaccination_date' => 'date:Y-m-d',
            'scheduled_date' => 'date:Y-m-d',
        ];
    }

    /**
     * Whoever the dose was given to.
     *
     * Still called `child` because the column is `child_id` — but the ITR's
     * adult immunizations (flu, tetanus toxoid, COVID) are recorded here too.
     */
    public function child(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'child_id');
    }

    public function administrator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'administered_by');
    }
}
