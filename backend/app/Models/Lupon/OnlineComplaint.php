<?php

namespace App\Models\Lupon;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * A complaint begun online, before it is a case.
 *
 * AN ONLINE COMPLAINT REFERENCE NUMBER IS NOT A KP CASE NUMBER, and the two
 * are deliberately shaped so nobody can mistake one for the other:
 *
 *     OC-2026-0007      what the website gives back
 *     2026-09-25-03     what the Lupon's docket gives
 *
 * Nothing here has been accepted. The complainant still comes to the
 * office, is still identified against the ID they uploaded, the complaint
 * is still read, the fee is still paid — and only then does the Lupon press
 * Accept, which raises the real case and fills in `lupon_case_id`. That is
 * the one moment a reference number turns into a case number.
 */
class OnlineComplaint extends Model
{
    public const FOR_VERIFICATION = 'For Office Verification';

    public const ACCEPTED = 'Accepted';

    public const REJECTED = 'Rejected';

    public const WITHDRAWN = 'Withdrawn';

    /** What the office may still act on. */
    public const OPEN_STATUSES = [self::FOR_VERIFICATION];

    protected $fillable = [
        'reference_no', 'filer_kind', 'resident_id', 'resident_card_id',
        'complainant_name', 'complainant_address', 'complainant_contact',
        'respondent_name', 'respondent_address', 'case_classification',
        'narrative', 'date_of_occurrence', 'place_of_occurrence', 'relationship_nature',
        'valid_id_type', 'valid_id_number', 'valid_id_path',
        'status', 'lupon_case_id', 'handled_by', 'handled_at', 'office_notes',
    ];

    protected function casts(): array
    {
        return [
            'date_of_occurrence' => 'date:Y-m-d',
            'handled_at' => 'datetime',
        ];
    }

    /**
     * OC-2026-0007 — the year, then which submission of that year it is.
     *
     * One above the highest already issued, never a row count: a submission
     * removed must not hand its number back to the next one, or two people
     * end up quoting the same reference at the counter.
     */
    public static function nextReference(int $year): string
    {
        $highest = DB::table('online_complaints')
            ->where('reference_no', 'like', 'OC-' . $year . '-%')
            ->selectRaw("MAX(CAST(SUBSTRING_INDEX(reference_no, '-', -1) AS UNSIGNED)) AS highest")
            ->value('highest');

        return sprintf('OC-%d-%04d', $year, ((int) $highest) + 1);
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function luponCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class, 'lupon_case_id');
    }

    public function handledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function files(): HasMany
    {
        return $this->hasMany(OnlineComplaintFile::class);
    }
}
