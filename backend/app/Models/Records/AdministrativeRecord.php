<?php

namespace App\Models\Records;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class AdministrativeRecord extends Model
{
    /** Mirrors the document_type enum on administrative_records. */
    public const DOCUMENT_TYPES = [
        'Ordinance',
        'Resolution',
        'Executive Order',
        'Memorandum',
        'Meeting Minutes',
        'Committee Report',
        'Correspondence',
        'Contract',
        'Agreement',
        'Barangay Assembly Record',
        'Other',
    ];

    protected $fillable = [
        'document_type',
        'document_number',
        'document_title',
        'document_date',
        'document_content',
        'created_by',
        'approved_by',
        'approved_at',
        'is_archived',
        'file_reference',
        'summary',
    ];

    protected function casts(): array
    {
        return [
            'document_date' => 'date',
            'approved_at' => 'datetime',
            'is_archived' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
