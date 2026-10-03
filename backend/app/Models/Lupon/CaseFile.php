<?php

namespace App\Models\Lupon;

use App\Services\Lupon\FilingFeeDeadlines;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Services\Lupon\PartyNotice;
use Illuminate\Support\Facades\DB;

class CaseFile extends Model
{
    protected $table = 'lupon_cases';

    /**
     * Eager-load spec for any list that shows a hearing or a settlement
     * alongside its case and parties.
     *
     * The complainant columns are NOT optional: `complainant_display_name`
     * and `complainant_is_resident` are computed from `complainant_id` and
     * `complainant_name`, so omitting them from the select makes every case
     * look like it has no complainant — and hides non-resident filers
     * entirely. Kept in one place so the lists cannot drift apart again.
     */
    public const WITH_PARTIES = [
        'luponCase:id,case_number,case_title,case_classification,current_stage,jurisdiction_status,complainant_id,complainant_name,complainant_address,complainant_contact',
        'luponCase.complainant:id,first_name,middle_name,last_name',
        'luponCase.respondents:id,first_name,middle_name,last_name',
    ];

    /**
     * A change of stage reaches the parties' bells.
     *
     * On the model rather than in each controller: six different screens
     * move a case between stages (mediation recorded, settled at a sitting,
     * sent to conciliation, a settlement recorded or repudiated…), and a
     * notice written into five of them is a party left uninformed by the
     * sixth. PartyNotice decides what, if anything, is said — nothing before
     * the summons is served, and never anything about a referral.
     */
    protected static function booted(): void
    {
        /*
         * Filed means the filing fee is owed from now, and the three calendar
         * days start — see FilingFeeDeadlines. Every way a case is filed (the
         * counter, an online complaint accepted) comes through here.
         */
        static::creating(function (CaseFile $case) {
            if (($case->current_stage ?? 'Filed') === 'Filed' && $case->payment_status === null) {
                $case->payment_status = FilingFeeDeadlines::UNPAID;
                $case->payment_required_at = now();
                $case->payment_due_at = FilingFeeDeadlines::dueFrom(now());
            }
        });

        static::created(function (CaseFile $case) {
            if ($case->payment_status === FilingFeeDeadlines::UNPAID) {
                FilingFeeDeadlines::record($case, 'fee_required', 'Filing fee required; pay by '
                    . FilingFeeDeadlines::dueWords($case->payment_due_at) . ' (end of day), or the case closes unpaid.');
            }
        });

        static::updated(function (CaseFile $case) {
            if ($case->wasChanged('current_stage')) {
                app(PartyNotice::class)->stageChanged($case);
            }
        });
    }

    protected $fillable = [
        'case_number',
        'case_title',
        'case_classification',
        'complainant_id',
        // Used instead of complainant_id when the complainant lives outside
        // the barangay and therefore has no registry record.
        'complainant_name',
        'complainant_address',
        'complainant_contact',
        'jurisdiction_status',
        'rejection_reason',
        'current_stage',
        'date_filed',
        'date_resolved',
        /* Why it was withdrawn, or what the certification to court rests on.
           Left off this list it was silently dropped, and the register kept
           "Withdrawn" with no sentence beside it. */
        'closure_reason',
        'notes',
        'assigned_lupon_secretary',
        /* The filing fee's own state and its three days — apart from the
           stage on purpose. See FilingFeeDeadlines. */
        'payment_status',
        'payment_required_at',
        'payment_due_at',
        'auto_closed_at',
    ];

    protected function casts(): array
    {
        return [
            'date_filed' => 'date:Y-m-d',
            'date_resolved' => 'date:Y-m-d',
            'payment_required_at' => 'datetime',
            'payment_due_at' => 'datetime',
            'auto_closed_at' => 'datetime',
        ];
    }

    /** Always appended so the UI never has to branch on resident vs outsider. */
    protected $appends = [
        'complainant_display_name',
        'complainant_is_resident',
        'complainant_display_address',
        'complainant_display_contact',
        'complainant_reference',
        'respondent_display_names',
        'docket_number',
        'hearing_stage',
        'current_stage_label',
        'next_hearing_info',
    ];

    /** The complainant's name, whether they are a resident or an outsider. */
    public function getComplainantDisplayNameAttribute(): string
    {
        if ($this->complainant) {
            return trim($this->complainant->first_name . ' ' . $this->complainant->last_name);
        }

        return $this->complainant_name ?: '—';
    }

    public function getComplainantIsResidentAttribute(): bool
    {
        return $this->complainant_id !== null;
    }

    /*
    |--------------------------------------------------------------------------
    | A complainant who is on the register is not asked twice
    |--------------------------------------------------------------------------
    | Their address, number and household are already recorded, and the
    | register is where they are kept current. Copying them onto the case at
    | filing time would freeze them: a summons served six weeks later would go
    | to the house they have moved out of, and the case would still be showing
    | the old one as if it were fact.
    |
    | So the case READS them, and only stores what it cannot read — the
    | details of a complainant from another barangay, who has no record here.
    */

    /** Where the summons goes. */
    public function getComplainantDisplayAddressAttribute(): ?string
    {
        if ($this->complainant) {
            $household = $this->complainant->household;

            /*
             * A resident's street address lives on their HOUSEHOLD, not on
             * their own record — `residents.address` is for somebody who
             * lives outside the barangay, and is deliberately emptied when
             * such a person is converted to a resident. Reading only their
             * own column gave a purok and no street.
             */
            return trim(implode(', ', array_filter([
                $this->complainant->address ?: $household?->street_address,
                $this->complainant->zone_purok,
                $household?->household_number ? 'Household ' . $household->household_number : null,
            ]))) ?: null;
        }

        return $this->complainant_address;
    }

    /**
     * How the office reaches them: the number given for THIS case first (an
     * online complaint carries the one they typed), then their record's.
     */
    public function getComplainantDisplayContactAttribute(): ?string
    {
        return $this->complainant_contact ?: $this->complainant?->contact_number;
    }

    /**
     * Their resident number, when they have one.
     *
     * Null for somebody from another barangay — which is itself the answer to
     * "is this person on our register?", and the reason the address above had
     * to be typed in by hand.
     */
    public function getComplainantReferenceAttribute(): ?string
    {
        return $this->complainant?->resident_number;
    }

    /** "Dela Cruz, Gasang" — every respondent, for lists and search. */
    public function getRespondentDisplayNamesAttribute(): string
    {
        if (!$this->relationLoaded('respondents')) {
            return '';
        }

        return $this->respondents
            ->map(fn ($r) => trim($r->first_name . ' ' . $r->last_name))
            ->implode(', ');
    }

    /**
     * Permanent Case Docket Numbering in reverse chronological order:
     * Newest case = #1, Previous case = #2, Oldest case = #N.
     * Remains permanently associated with the case across search, filter, pagination, refresh.
     */
    public function getDocketNumberAttribute(): int
    {
        if (isset($this->attributes['docket_number'])) {
            return (int) $this->attributes['docket_number'];
        }

        if (! $this->exists || ! $this->date_filed) {
            return 1;
        }

        return (int) DB::table('lupon_cases')
            ->where(function ($q) {
                $q->where('date_filed', '>', $this->date_filed)
                    ->orWhere(function ($q2) {
                        $q2->where('date_filed', $this->date_filed)
                            ->where('id', '>=', $this->id);
                    });
            })
            ->count();
    }

    /**
     * Current hearing stage of the case for docket display:
     * e.g. "Hearing with Punong Barangay", "Hearing with Lupon (Pangkat)", etc.
     */
    public function getHearingStageAttribute(): string
    {
        return match ($this->current_stage) {
            'Mediation' => 'Hearing with Punong Barangay',
            'Conciliation' => 'Hearing with Lupon',
            'For Summons' => 'For Summons (Punong Barangay)',
            'For Lupon Summons' => 'For Summons (Lupon)',
            'Filed' => 'Filed',
            'Settled' => 'Amicable Settlement',
            'Repudiated' => 'Repudiated Settlement',
            'CFA' => 'Certified to File Action',
            'Withdrawn' => 'Withdrawn',
            'Closed — Unpaid', 'Closed Unpaid' => 'Closed (Unpaid)',
            default => $this->current_stage ?: '—',
        };
    }

    /**
     * Clear high-level stage label: "Punong Barangay" vs "Lupon"
     */
    public function getCurrentStageLabelAttribute(): string
    {
        if (in_array($this->current_stage, ['Filed', 'For Summons', 'Mediation'], true)) {
            return 'Punong Barangay';
        }
        if (in_array($this->current_stage, ['For Lupon Summons', 'Conciliation'], true)) {
            return 'Lupon';
        }
        return match ($this->current_stage) {
            'Settled' => 'Settled',
            'CFA' => 'Certified to File Action',
            'Withdrawn' => 'Withdrawn',
            'Dismissed' => 'Dismissed',
            'Closed — Unpaid', 'Closed Unpaid' => 'Closed (Unpaid)',
            default => $this->current_stage ?: '—',
        };
    }

    /**
     * Returns next scheduled hearing info for the case docket.
     */
    public function getNextHearingInfoAttribute(): ?array
    {
        if ($this->isClosed()) {
            return [
                'stage' => $this->current_stage_label,
                'title' => 'None (' . $this->current_stage . ')',
                'schedule' => '—',
                'day_time' => '—',
                'summons_status' => 'None',
                'hearing_id' => null,
            ];
        }

        $isPB = in_array($this->current_stage, ['Filed', 'For Summons', 'Mediation'], true);
        $stageName = $isPB ? 'Punong Barangay' : 'Lupon';
        $type = $isPB ? 'Mediation' : 'Conciliation';

        // Find active scheduled hearing for this stage
        $hearingsColl = $this->relationLoaded('hearings') ? $this->hearings : null;
        $activeHearing = $hearingsColl
            ? $hearingsColl->where('hearing_type', $type)->where('status', 'Scheduled')->sortBy('scheduled_at')->first()
            : $this->hearings()->where('hearing_type', $type)->where('status', 'Scheduled')->orderBy('scheduled_at')->first();

        if ($activeHearing) {
            $seq = $activeHearing->hearing_sequence;
            $title = "{$stageName} Hearing #{$seq}";
            $timeRange = $activeHearing->schedule_time_range ?: $activeHearing->scheduled_at->format('g:i A');
            $dayName = $activeHearing->scheduled_at->format('l');

            return [
                'stage' => $stageName,
                'title' => $title,
                'schedule' => "{$dayName}, {$timeRange}",
                'day_time' => "{$dayName}, " . $activeHearing->scheduled_at->format('g:i A'),
                'summons_status' => $activeHearing->summons_issued ? 'Issued' : 'Prepared',
                'hearing_id' => $activeHearing->id,
            ];
        }

        // If not yet scheduled
        $pastCount = $hearingsColl
            ? $hearingsColl->where('hearing_type', $type)->count()
            : $this->hearings()->where('hearing_type', $type)->count();
        $seq = $pastCount + 1;
        $title = "{$stageName} Hearing #{$seq}";

        return [
            'stage' => $stageName,
            'title' => $title,
            'schedule' => $isPB ? 'Tuesday (Pending Summons)' : 'Thursday (Pending Summons)',
            'day_time' => 'Pending Summons',
            'summons_status' => 'Pending',
            'hearing_id' => null,
        ];
    }

    public function complainant(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'complainant_id');
    }

    /**
     * Everyone complained against. A dispute with two aggressors is one case
     * with two respondents, not two cases.
     */
    public function respondents()
    {
        return $this->belongsToMany(Resident::class, 'lupon_case_respondents', 'lupon_case_id', 'resident_id')
            ->withTimestamps();
    }

    /**
     * Cases whose summons has been PRINTED — the paper exists, so the
     * parties may be told.
     *
     * The line between the Lupon's desk and the parties' portal. Until the
     * Barangay Secretary prints the summons the case is the Lupon's
     * paperwork: a respondent does not learn of a complaint from a phone
     * notification before there is a summons to hand them.
     *
     * It used to be proof of SERVICE that opened the portal. The office
     * asked for the notice to go with the printed summons instead — the
     * paper and the notice leave the barangay together — and proof of
     * service is still recorded on the hearing afterwards.
     */
    public function scopeSummonsIssued($query)
    {
        return $query->whereHas('hearings', fn ($h) => $h->where('summons_issued', true));
    }

    public function summonsWasIssued(): bool
    {
        return $this->hearings()->where('summons_issued', true)->exists();
    }

    public function summonsWasServed(): bool
    {
        return $this->hearings()->whereNotNull('summons_served_date')->exists();
    }

    /**
     * Has a sitting before the Lupon been held and ended without agreement?
     *
     * What the Certificate to File Action rests on. A settled sitting does
     * not count, and neither does one still to be held: the certificate
     * states that the barangay's process was tried, and a court can refuse
     * one that says so before the Lupon ever sat.
     */
    public function conciliationWasTried(): bool
    {
        return $this->hearings()
            ->where('hearing_type', 'Conciliation')
            ->where('status', 'Completed')
            ->where(function ($q) {
                $q->whereNull('outcome')->orWhere('outcome', '!=', 'Agreement');
            })
            ->exists();
    }

    /**
     * NATURE OF THE CASE — the one list, for the counter, the online form
     * and the docket alike. The case's title follows it (see StoreCaseRequest
     * and OnlineComplaintController::accept), so the two never disagree.
     */
    public const NATURES = [
        'Assault', 'Theft', 'Property Damage', 'Libel', 'Ejectment', 'Debt', 'Family Dispute', 'Land Dispute', 'Others',
    ];

    /** Closed by the system: the filing fee was not paid within its three days. */
    public const CLOSED_UNPAID = 'Closed — Unpaid';

    /** Ends: nothing more is scheduled, and the fee can no longer change. */
    public const CLOSED_STAGES = ['Settled', 'Dismissed', 'Referred', 'CFA', 'Withdrawn', self::CLOSED_UNPAID];

    public function isClosed(): bool
    {
        return in_array($this->current_stage, self::CLOSED_STAGES, true);
    }

    /** Resident ids of every party — used to notify them of hearings. */
    public function partyResidentIds(): array
    {
        return collect([$this->complainant_id])
            ->merge($this->respondents()->pluck('residents.id'))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * 2026-08-08-01 — the Lupon's own numbering: the date the case was
     * filed, then which case of THAT MONTH it is.
     *
     * The count starts again each month, and it is one above the highest
     * already issued in the month — never a row count, for the reason
     * SequenceNumber gives: a case removed must not hand its number to the
     * next one. Two digits, as the office writes it; the hundredth case of a
     * month simply gets three.
     *
     * @param string $dateFiled "Y-m-d", Manila's date
     */
    public static function nextCaseNumber(string $dateFiled): string
    {
        $month = substr($dateFiled, 0, 7);

        $highest = DB::table('lupon_cases')
            ->where('case_number', 'like', $month . '-__-%')
            ->selectRaw("MAX(CAST(SUBSTRING_INDEX(case_number, '-', -1) AS UNSIGNED)) AS highest")
            ->value('highest');

        return $dateFiled . '-' . str_pad((string) (((int) $highest) + 1), 2, '0', STR_PAD_LEFT);
    }

    public function assignedLuponSecretary(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_lupon_secretary');
    }

    public function complaint(): HasOne
    {
        return $this->hasOne(Complaint::class, 'lupon_case_id');
    }

    /**
     * The fees on this case: the ₱20 to file, the ₱230 to certify to court.
     *
     * Asked for by the Lupon and taken at the Clerk's counter, so the case
     * carries them and both offices read the same row.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'lupon_case_id');
    }

    /** True once the filing fee has actually been taken. Gates the summons. */
    public function getFilingFeePaidAttribute(): bool
    {
        return $this->payments
            ->where('kind', Payment::KIND_FILING)
            ->where('status', 'Paid')
            ->isNotEmpty();
    }

    public function hearings(): HasMany
    {
        return $this->hasMany(Hearing::class, 'lupon_case_id');
    }

    public function settlement(): HasOne
    {
        return $this->hasOne(Settlement::class, 'lupon_case_id');
    }
}
