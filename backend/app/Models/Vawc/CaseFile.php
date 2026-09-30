<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Support\SequenceNumber;

class CaseFile extends Model
{
    protected $table = 'vawc_cases';

    /**
     * The one-word column follows the list, always.
     *
     * `violence_type` is read by the quarterly forms, the case filter and
     * the yearly report, and it is NOT NULL. Kept in step here rather than
     * in each controller, because a case saved from a screen that forgot to
     * set it would drop out of the return without anyone noticing — and a
     * VAW case missing from the return is the one number the barangay is
     * legally obliged to submit.
     *
     * More than one kind is "Mixed", which is what that word was always
     * for; the list beside it says which.
     */
    protected static function booted(): void
    {
        static::saving(function (CaseFile $case) {
            $types = $case->violence_types;

            if (! is_array($types) || $types === []) {
                return;
            }

            $case->violence_type = count($types) > 1 ? 'Mixed' : $types[0];
        });
    }

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

    /**
     * THE FOUR KINDS RA 9262 NAMES, and a case may be any number of them.
     *
     * The intake form offered two, and one at a time. A woman describing a
     * beating, the threats that came with it and the wages taken off her had
     * to be filed as ONE of those things and the desk chose — so the other
     * two went unrecorded, the quarterly return under-reported them, and the
     * next officer to open the file saw a narrower case than the one that
     * walked in.
     *
     * "Threat" is gone from what a new case may be filed as: a threat is
     * psychological violence under §3(c), and it is listed below as one of
     * the acts. Old cases filed as Threat keep the word (VIOLENCE_TYPES
     * above) — the record is not bent to fit a later form.
     */
    public const INTAKE_VIOLENCE_TYPES = ['Physical', 'Sexual', 'Psychological', 'Economic'];

    /**
     * The specific acts under each kind, as RA 9262 §3 sets them out.
     *
     * OPTIONAL, ALWAYS. A survivor recounting what happened is not filling
     * in a checklist, and an officer who cannot find the exact act on this
     * list must still be able to record the kind. Choosing a kind is the
     * record; choosing an act is detail the desk adds when it has it.
     */
    public const VIOLENCE_ACTS = [
        'Physical' => [
            'Hitting or punching', 'Slapping', 'Kicking', 'Pushing', 'Strangling',
            'Beating', 'Causing physical injuries',
        ],
        'Sexual' => [
            'Rape', 'Sexual harassment', 'Acts of lasciviousness', 'Forced sexual activity',
            'Forcing the victim to perform sexual acts', 'Sexual coercion',
            'Prostituting the woman or child',
        ],
        'Psychological' => [
            'Intimidation', 'Harassment', 'Stalking', 'Public humiliation',
            'Repeated verbal abuse', 'Threatening', 'Marital infidelity',
            'Controlling or frightening the victim',
            'Making the victim witness violence against another person',
        ],
        'Economic' => [
            'Withholding financial support', 'Preventing the woman from working',
            'Controlling her money', 'Depriving her or the children of financial resources',
            'Destroying or controlling property',
            'Preventing access to legitimate livelihood or financial resources',
        ],
    ];

    /** Every act, flattened — what a submitted list is validated against. */
    public static function allViolenceActs(): array
    {
        return array_merge(...array_values(self::VIOLENCE_ACTS));
    }

    /**
     * Who reported the case — asked outright instead of a checkbox.
     *
     * "Victim-Survivor" means she came in herself, and then nobody else's
     * name, number or consent belongs on the case.
     */
    public const REPORTER_TYPES = [
        'Victim-Survivor', 'Parent/Guardian', 'Relative', 'Friend/Support Person',
        'Barangay Official', 'Police Officer', 'Social Worker', 'Other',
    ];

    /**
     * The relationship of the victim-survivor to the respondent.
     *
     * Anything else the desk types under "Other (Specify)" is stored as the
     * words typed, and null is "Not Recorded".
     */
    public const RELATIONSHIPS = [
        'Spouse', 'Former Spouse', 'Cohabiting Partner', 'Dating Partner', 'Sexual Partner',
    ];

    /** The immediate safety assessment's first question. */
    public const DANGER_ANSWERS = ['Yes', 'No', 'Unknown'];

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
        'Ongoing concern' => 'High',
        'Immediate danger' => 'Critical',
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

    /**
     * The risk level an immediate safety assessment sets.
     *
     * Somebody in danger right now is Critical, whatever the level said
     * before. "No" and "Unknown" set nothing: not being in danger this
     * minute is not the same as being safe, and only the desk's own judgment
     * may lower a level.
     */
    public static function riskFromDanger(?string $currentlyInDanger): ?string
    {
        return $currentlyInDanger === 'Yes' ? 'Critical' : null;
    }
    protected $fillable = [
        'case_code',
        'survivor_id',
        // Victim-Survivor, Parent/Guardian, Relative, … — see REPORTER_TYPES.
        'reported_by_type',
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
        /* The kinds this case is, and the acts under them the desk noted.
           `violence_type` is kept in step with the first of the list so the
           quarterly forms and the case filter that read it keep working. */
        'violence_types',
        'violence_acts',
        'risk_level',
        'risk_assessed_at',
        /* The immediate safety assessment. */
        'currently_in_danger',
        'protection_needed',
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
            'violence_types' => 'array',
            'violence_acts' => 'array',
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

    /** Every BPO applied for or issued on this case, newest first. */
    public function protectionOrders(): HasMany
    {
        return $this->hasMany(ProtectionOrder::class, 'vawc_case_id')->latest('id');
    }

    /** The case assessment and action plan — one per case. */
    public function assessment(): HasOne
    {
        return $this->hasOne(Assessment::class, 'vawc_case_id');
    }

    /** Child and dependent welfare — one record per case. */
    public function childWelfare(): HasOne
    {
        return $this->hasOne(ChildWelfare::class, 'vawc_case_id');
    }
}
