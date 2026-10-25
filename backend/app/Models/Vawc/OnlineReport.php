<?php

namespace App\Models\Vawc;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Support\SequenceNumber;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * A VAWC report sent online by a resident — see the vawc_online_reports
 * migration and App\Services\Vawc\OnlineReports.
 */
class OnlineReport extends Model
{
    protected $table = 'vawc_online_reports';

    public const FOR_VERIFICATION = 'For Verification';

    /** Verified by the VAW Desk, and opened as a case. */
    public const ACCEPTED = 'Accepted';

    public const DECLINED = 'Declined';

    public const VIA_PUBLIC = 'Public';

    public const VIA_PORTAL = 'Portal';

    /** Who the person is to her — the case's own list, plus "Other". */
    public const RELATIONSHIPS = [...CaseFile::RELATIONSHIPS, 'Other'];

    protected $fillable = [
        'reference_no', 'resident_id', 'resident_card_id', 'filed_via',
        'violence_types', 'narrative', 'occurred_on', 'place', 'respondent_name', 'respondent_address', 'respondent_id', 'relationship',
        'threatened', 'in_danger_now', 'safe_contact', 'safe_time', 'id_path', 'evidence_paths',
        'status', 'visit_required', 'confirmed_in_person', 'vawc_case_id',
        'reviewed_by', 'reviewed_at', 'office_note',
    ];

    /* Never in a list or a log by accident. */
    protected $hidden = ['id_path'];

    protected function casts(): array
    {
        return [
            'violence_types' => 'encrypted:array',
            'evidence_paths' => 'encrypted:array',
            'narrative' => 'encrypted',
            'place' => 'encrypted',
            'respondent_name' => 'encrypted',
            'respondent_address' => 'encrypted',
            'safe_contact' => 'encrypted',
            'safe_time' => 'encrypted',
            'office_note' => 'encrypted',
            'occurred_on' => 'date:Y-m-d',
            'threatened' => 'boolean',
            'in_danger_now' => 'boolean',
            'visit_required' => 'boolean',
            'confirmed_in_person' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    /** VR-2026-0001 — one above the highest ever issued. */
    public static function nextReference(int $year): string
    {
        return SequenceNumber::next('vawc_online_reports', 'reference_no', 'VR-' . $year . '-', 4);
    }

    /** The report's own access trail. */
    public function logView(string $action): void
    {
        DB::table('vawc_online_report_views')->insert([
            'vawc_online_report_id' => $this->id,
            'user_id' => auth()->id(),
            'action' => $action,
            'created_at' => now(),
        ]);
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    /** The respondent on the register — chosen by the VAW Desk when it verifies the complaint. */
    public function respondent(): BelongsTo
    {
        return $this->belongsTo(Resident::class, 'respondent_id');
    }

    public function card(): BelongsTo
    {
        return $this->belongsTo(ResidentCard::class, 'resident_card_id');
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'vawc_case_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
