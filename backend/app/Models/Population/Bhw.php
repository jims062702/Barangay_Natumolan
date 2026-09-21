<?php

namespace App\Models\Population;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A Barangay Health Worker, and the zones she covers.
 *
 * Her areas are not a field on her record: they are the zones pointing at
 * her. Assigning a zone is done from the zone, and her list of areas follows
 * — so the two can never disagree about who covers Zone 5.
 */
class Bhw extends Model
{
    use HasFactory;

    protected $table = 'bhws';

    protected $fillable = ['name', 'contact_number', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function zones(): HasMany
    {
        return $this->hasMany(Zone::class);
    }
}
