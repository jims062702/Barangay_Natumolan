<?php

namespace App\Models\Council;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    use HasFactory;

    protected $fillable = [
        'appointment_number',
        'resident_id',
        'applicant_type',
        'is_walk_in',
        'full_name',
        'address',
        'phone_number',
        'email',
        'appointment_date',
        'appointment_time',
        'purpose',
        'status',
        'minutes',
        'rejection_reason',
        'id_card_code',
        'id_photo_path',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'is_walk_in' => 'boolean',
            'appointment_date' => 'date:Y-m-d',
            'approved_at' => 'datetime',
        ];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public static function nextNumber(): string
    {
        $today = now()->format('Ymd');
        $count = self::whereDate('created_at', today())->count() + 1;
        return sprintf('APT-%s-%04d', $today, $count);
    }
}
