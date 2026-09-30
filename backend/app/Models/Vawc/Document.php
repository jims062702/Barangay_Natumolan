<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Document extends Model
{
    protected $table = 'vawc_documents';

    /** The kinds of paper a VAW Desk keeps on a case. */
    public const TYPES = [
        'BPO', 'Incident Report', 'Victim-Survivor Statement', 'Referral Form', 'Medical Document',
        'Social Case Study', 'Police Document', 'Court/Protection Order Document', 'Child-related Document',
        'Other',
    ];

    protected $fillable = [
        'vawc_case_id',
        'document_type',
        'document_date',
        'title',
        'description',
        'file_reference',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'document_date' => 'date:Y-m-d',
            'description' => 'encrypted',
        ];
    }

    public function vawcCase(): BelongsTo
    {
        return $this->belongsTo(CaseFile::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
