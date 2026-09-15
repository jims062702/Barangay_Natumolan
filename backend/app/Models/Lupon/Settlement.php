<?php

namespace App\Models\Lupon;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Settlement extends Model
{
    protected $table = 'lupon_settlements';

    protected $fillable = [
        'lupon_case_id',
        'settlement_type',
        'terms',
        'date_agreed',
        'repudiation_deadline',
        'status',
        'compliance_deadline',
        'compliance_notes',
        'cfa_issued',
        'cfa_issued_at',
        'cba_issued',
        'cba_issued_at',
        'closed_at',
        'recorded_by',
    ];

    /**
     * Settlements whose 10-day repudiation window has lapsed become final.
     *
     * Run before a register or an alert list is read, so neither ever shows a
     * stale "still repudiable" row.
     */
    public static function finaliseLapsedRepudiations(): void
    {
        static::where('status', 'Within Repudiation Period')
            ->whereDate('repudiation_deadline', '<', today())
            ->update(['status' => 'Final']);
    }

    protected function casts(): array
    {
        return [
            'date_agreed' => 'date',
            'repudiation_deadline' => 'date',
            'compliance_deadline' => 'date',
            'cfa_issued' => 'boolean',
            'cba_issued' => 'boolean',
            'cfa_issued_at' => 'datetime',
            'cba_issued_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function luponCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
