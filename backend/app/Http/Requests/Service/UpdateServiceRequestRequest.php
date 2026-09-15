<?php

namespace App\Http\Requests\Service;

use Illuminate\Foundation\Http\FormRequest;

/**
 * "Approved" is intentionally not settable here. Certificates are no longer
 * approved by anyone: the request simply follows the clerk's work on the
 * document.
 */
class UpdateServiceRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'status' => 'in:Pending,In Progress,Completed,Rejected',
            'purpose' => 'nullable|string',
            'assigned_to' => 'nullable|exists:users,id',
        ];
    }
}
