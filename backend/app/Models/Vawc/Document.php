<?php

namespace App\Models\Vawc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;

class Document extends Model
{
    protected $table = 'vawc_documents';

    protected $fillable = [
        'vawc_case_id',
        'document_type',
        'title',
        'description',
        'file_reference',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
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
