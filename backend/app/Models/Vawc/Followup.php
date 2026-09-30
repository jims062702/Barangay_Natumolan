<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Followup extends Model
{
    protected $table = 'vawc_followups';

    /** How the follow-up was made. Stored in `followup_type`. */
    public const METHODS = ['In Person', 'Phone', 'Home Visit', 'Referral Agency', 'Other'];

    /**
     * What the desk found. Each moves the case's risk level except
     * "Unknown" — see CaseFile::RISK_FROM_SAFETY.
     */
    public const SAFETY_STATUSES = ['Safe', 'Ongoing concern', 'Immediate danger', 'Unknown'];

    /** Where the protection order stands on the day of the follow-up. */
    public const PROTECTION_ORDER_STATUSES = [
        'No BPO', 'BPO applied', 'BPO in effect', 'BPO expired', 'BPO violated', 'Referred for TPO/PPO',
    ];

    protected $fillable = [
        'vawc_case_id',
        'followup_date',
        'followup_type',
        'conducted_by',
        'safety_status',
        'protection_order_status',
        'referral_attended',
        'services_received',
        'new_incident',
        'additional_needs',
        'next_action',
        'notes',
        'next_followup_date',
        'closure_recommended',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'followup_date' => 'date:Y-m-d',
            'next_followup_date' => 'date:Y-m-d',
            'referral_attended' => 'boolean',
            'new_incident' => 'boolean',
            'closure_recommended' => 'boolean',
            /* What she received, still needs, and what happens next all
               describe her circumstances: encrypted, like the notes. */
            'services_received' => 'encrypted',
            'additional_needs' => 'encrypted',
            'next_action' => 'encrypted',
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
