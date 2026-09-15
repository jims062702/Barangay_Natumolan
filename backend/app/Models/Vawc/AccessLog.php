<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class AccessLog extends Model
{
    protected $table = 'vawc_access_logs';

    protected $fillable = [
        'vawc_case_id',
        'user_id',
        'action',
        'detail',
    ];

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Record an access-trail entry for a confidential case. */
    public static function record(int $caseId, string $action, ?string $detail = null): self
    {
        return self::create([
            'vawc_case_id' => $caseId,
            'user_id' => auth()->id(),
            'action' => $action,
            'detail' => $detail,
        ]);
    }
}
