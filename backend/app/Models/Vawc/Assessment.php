<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The case assessment and action plan — one per case, corrected in place.
 *
 * What the victim-survivor reported and asked for, what the desk found, what
 * it did, and what happens next. It replaces "what was agreed" as the record
 * a VAWC case is worked from: the desk's job is protection and referral, not
 * a settlement between the parties.
 */
class Assessment extends Model
{
    protected $table = 'vawc_assessments';

    public const PERSONS_PRESENT = [
        'Victim-Survivor', 'VAW Desk Officer', 'Respondent', 'Social Worker', 'Support Person', 'Other',
    ];

    public const SERVICES = [
        'BPO assistance', 'MSWDO referral', 'Police referral', 'Medical referral', 'Legal referral',
        'Psychosocial support', 'Other',
    ];

    protected $fillable = [
        'vawc_case_id', 'assessment_date', 'persons_present', 'statement', 'observations',
        'services_provided', 'action_plan', 'next_followup_date', 'informed_of_rights',
        'protection_order_offered', 'referral_made', 'next_steps_documented', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'assessment_date' => 'date:Y-m-d',
            'next_followup_date' => 'date:Y-m-d',
            'persons_present' => 'array',
            'services_provided' => 'array',
            'informed_of_rights' => 'boolean',
            'protection_order_offered' => 'boolean',
            'referral_made' => 'boolean',
            'next_steps_documented' => 'boolean',
            /* What she said and what the desk found: encrypted, like the rest. */
            'statement' => 'encrypted',
            'observations' => 'encrypted',
            'action_plan' => 'encrypted',
        ];
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'vawc_case_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
