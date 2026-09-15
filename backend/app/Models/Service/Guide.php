<?php

namespace App\Models\Service;

use Illuminate\Database\Eloquent\Model;

class Guide extends Model
{
    protected $table = 'service_guides';

    protected $fillable = [
        'office',
        'service_name',
        'description',
        'requirements',
        'fees',
        'schedule',
        'keywords',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
