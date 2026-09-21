<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Support\SequenceNumber;

class CaseFile extends Model
{
    protected $table = 'vawc_cases';

    /**
     * How urgent this case is, from most to least.
     *
     * One scale for the whole module. Words rather than colours, because a
     * colour is unreadable to a screen reader and indistinguishable to a
     * colour-blind officer — and this is the field that decides who gets
     * visited first.
     */
    public const RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low'];

    /**
     * Every kind of violence the column can hold.
     *
     * Two lists, deliberately. INTAKE_VIOLENCE_TYPES is what the desk may
     * choose today; VIOLENCE_TYPES is everything a stored case might say,
     * including the four the form stopped offering. Validating an EDIT
     * against the narrow list would make an old case unsaveable until its
     * kind was changed — which is the record being bent to fit the form.
     */
    public const VIOLENCE_TYPES = [
        'Threat', 'Physical', 'Psychological', 'Economic', 'Sexual', 'Mixed',
    ];

    /** What a new case may be filed as. Mirrors the intake form's dropdown. */
    public const INTAKE_VIOLENCE_TYPES = ['Threat', 'Physical'];

    /**
     * How a follow-up's safety finding moves the case's risk level.
     *
     * Risk is not a fact about the day a case was filed. A survivor found
     * safe on a home visit is not still Critical, and one found in danger is
     * not still Low because that is what the first interview concluded. So
     * every follow-up re-states it.
     *
     * "Unknown" moves nothing on purpose: it says the officer could not
     * tell, which is not the same as finding somebody safe, and letting it
     * lower a Critical case would be the most dangerous thing this table
     * could do.
     */
    public const RISK_FROM_SAFETY = [
        'Safe' => 'Low',
        'At Risk' => 'High',
        'Critical' => 'Critical',
    ];

    /** VAWC-2026-0001 — one above the highest ever issued. */
    public static function nextCaseCode(): string
    {
        return SequenceNumber::next('vawc_cases', 'case_code', 'VAWC-' . date('Y') . '-', 4);
    }

    /**
     * Re-states the risk from a follow-up's finding.
     *
     * Called wherever a follow-up is recorded, so the docket shows what was
     * last actually seen rather than what was first assumed.
     */
    public function reassessRiskFrom(?string $safetyStatus, ?string $on = null): void
    {
        $level = self::RISK_FROM_SAFETY[$safetyStatus] ?? null;

        if ($level === null) {
            return;
        }

        $this->update([
            'risk_level' => $level,
            'risk_assessed_at' => $on ?: now(),
        ]);
    }
    protected $fillable = [
        'case_code',
        'survivor_id',
        // Who brought the complaint, when that is not the survivor.
        'reported_by_name',
        /* Set when the reporter is on the register — a resident OR a
           recorded non-resident. The name above stays either way. */
        'reported_by_resident_id',
        'reported_by_relationship',
        'reported_by_contact',
        /* Item 9: on what authority somebody files for another person. */
        'applicant_consent',
        /* Item 4 of the protection-order application. An id when the register
           knows them; typed details when it does not. */
        'respondent_id',
        'violence_type',
        'risk_level',
        'risk_assessed_at',
        'reporting_channel',
        'relationship_to_offender',
        'children_involved',
        'children_count',
        'children_details',
        'immediate_needs',
        'previous_incidents_count',
        'assigned_vawc_officer',
        'status',
        'confidential_notes',
        'report_date',
        'closed_at',
    ];

    /**
     * The one session this case gets, and what was agreed at it.
     *
     * hasOne, because there is one — the table's unique key says so. The
     * desk hears the parties once; a series of sittings is mediation, and
     * mediating a VAWC matter is prohibited.
     */
    public function agreement()
    {
        return $this->hasOne(Agreement::class, 'vawc_case_id');
    }

    protected function casts(): array
    {
        return [
            'children_involved' => 'boolean',
            'report_date' => 'datetime',
            'risk_assessed_at' => 'datetime',
            'closed_at' => 'datetime',
            // Confidential content is encrypted at rest (spec requirement).
            'immediate_needs' => 'encrypted',
            'confidential_notes' => 'encrypted',
            'children_details' => 'encrypted',
            /*
             * Item 9 describes a survivor's circumstances, so it is encrypted
             * like everything else the desk writes about her.
             *
             * The respondent needs no encrypted columns: they are a plain
             * foreign key into the register, which holds their name and
             * address already. The columns that once copied those details
             * here existed only to carry a respondent from OUTSIDE the
             * barangay — and there is no such respondent, because an order
             * can only be issued against somebody who lives here.
             */
            'applicant_consent' => 'encrypted',
        ];
    }

    /**
     * Who brought the complaint, when they are on the register.
     *
     * Often nobody: the survivor reported it herself, or the reporter is a
     * passer-by nobody has registered. `reported_by_name` covers those.
     */
    public function reporter()
    {
        return $this->belongsTo(Resident::class, 'reported_by_resident_id');
    }

    public function survivor(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'survivor_id');
    }

    /**
     * Who the complaint is against — always a resident of this barangay.
     *
     * Null only while the desk has not named anybody yet. It is never
     * somebody from outside: a barangay protection order is issued by this
     * barangay against one of its own, and the Punong Barangay has no power
     * over a person who lives elsewhere. StoreCaseRequest refuses one.
     */
    public function respondent(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'respondent_id');
    }

    /**
     * Children/dependents involved, linked to their registry records so the
     * desk can open them and carry them into a referral.
     */
    public function dependents()
    {
        return $this->belongsToMany(Resident::class, 'vawc_case_dependents', 'vawc_case_id', 'resident_id')
            ->withTimestamps();
    }

    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_vawc_officer');
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class, 'vawc_case_id');
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class, 'vawc_case_id');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(Followup::class, 'vawc_case_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'vawc_case_id');
    }

    public function accessLogs(): HasMany
    {
        return $this->hasMany(AccessLog::class, 'vawc_case_id');
    }
}
