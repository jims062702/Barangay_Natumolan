<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The children and dependents on a case, and the support they need.
 *
 * Its own record, deliberately apart from any dialogue between the parties:
 * a child's food, schooling and care are a welfare matter to be referred —
 * to the MSWDO, to legal assistance — not a term somebody agrees to.
 */
class ChildWelfare extends Model
{
    protected $table = 'vawc_child_welfare';

    public const SUPPORT_TYPES = ['Food', 'Education', 'Medical', 'Clothing', 'Housing', 'Childcare', 'Other'];

    public const REFERRALS = ['MSWDO/CSWDO', 'PAO/Legal Assistance', 'Other'];

    protected $fillable = [
        'vawc_case_id', 'children', 'support_needed', 'support_types', 'current_support',
        'referral_needed', 'referral_other', 'notes', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            /* Per child: resident_id, relationship, caregiver, living
               arrangement, immediate needs — where a child lives is exactly
               what must not be readable off a copied database. */
            'children' => 'encrypted:array',
            'support_types' => 'array',
            'referral_needed' => 'array',
            'notes' => 'encrypted',
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
