<?php

namespace App\Models\Health;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Somebody bitten, and where the station sent them.
 *
 * A REFERRAL, not a course of treatment. A barangay health station does not
 * give the rabies series — that happens at an Animal Bite Treatment Centre —
 * so what this record exists to answer is "did we send them, and where?".
 * There is deliberately no dose schedule here: a field for one would invite
 * a station to manage a case it is not equipped to manage.
 */
class AnimalBiteReferral extends Model
{
    protected $table = 'animal_bite_referrals';

    /** What the guideline recognises. Dog by a wide margin, but not only. */
    public const ANIMALS = ['Dog', 'Cat', 'Monkey', 'Bat', 'Rat', 'Other'];

    /** Whether the animal can be watched for ten days — the urgency question. */
    public const ANIMAL_STATUSES = ['Owned', 'Stray', 'Unknown'];

    /** National categories I/II/III; the centre decides what to give from it. */
    public const EXPOSURE_CATEGORIES = ['Category I', 'Category II', 'Category III'];

    protected $fillable = [
        'patient_id',
        'bite_date',
        'bite_time',
        'place_of_incident',
        'animal',
        'animal_status',
        'animal_vaccinated',
        'exposure_category',
        'wound_description',
        'wound_washed',
        'referred_to',
        'referred_on',
        'referred_by',
        'attended',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'bite_date' => 'date',
            'referred_on' => 'date',
            'wound_washed' => 'boolean',
            /*
             * Both nullable booleans, and the null means something.
             *
             * "We do not know whether the dog was vaccinated" is not "it was
             * not", and "nobody has asked whether they went" is not "they
             * did not go". Defaulting either to false would turn an open
             * question into a false answer in the register.
             */
            'animal_vaccinated' => 'boolean',
            'attended' => 'boolean',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'patient_id');
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by');
    }
}
