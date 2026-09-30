<?php

namespace App\Models\Lupon;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Services\Lupon\PartyNotice;

class Settlement extends Model
{
    protected $table = 'lupon_settlements';

    /**
     * A settlement that moves on — final, repudiated, complied — reaches the
     * parties' bells. See PartyNotice for what is said and when.
     */
    protected static function booted(): void
    {
        static::updated(function (Settlement $settlement) {
            if ($settlement->wasChanged('status')) {
                app(PartyNotice::class)->settlementChanged($settlement);
            }
        });
    }

    protected $fillable = [
        'lupon_case_id',
        'settlement_type',
        'terms',
        'date_agreed',
        'repudiation_deadline',
        'status',
        'compliance_deadline',
        'compliance_notes',
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
        /*
         * One row at a time, not one UPDATE: a bulk update fires no model
         * events, so the parties would never be told their settlement had
         * become final. There are only ever a handful of these.
         */
        static::where('status', 'Within Repudiation Period')
            ->whereDate('repudiation_deadline', '<', today())
            ->get()
            ->each(fn (Settlement $s) => $s->update(['status' => 'Final']));
    }

    protected function casts(): array
    {
        return [
            'date_agreed' => 'date',
            'repudiation_deadline' => 'date',
            'compliance_deadline' => 'date',
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
