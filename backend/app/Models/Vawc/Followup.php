<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Followup extends Model
{
    protected $table = 'vawc_followups';

    protected $fillable = [
        'vawc_case_id',
        'followup_date',
        'followup_type',
        'safety_status',
        'bpo_compliance',
        'referral_attended',
        'services_received',
        'notes',
        'next_followup_date',
        'closure_recommended',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'followup_date' => 'date',
            'next_followup_date' => 'date',
            'referral_attended' => 'boolean',
            'closure_recommended' => 'boolean',
            'notes' => 'encrypted',
        ];
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
