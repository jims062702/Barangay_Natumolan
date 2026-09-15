<?php

namespace App\Http\Requests\Lupon;

use App\Services\Lupon\SettlementActions;
use Illuminate\Foundation\Http\FormRequest;

/**
 * An action from the compliance register.
 *
 * `action` is optional: omitting it records the compliance deadline and
 * notes WITHOUT advancing the status, so editing terms can never finalize
 * a settlement that is still inside its repudiation window.
 */
class RegisterSettlementActionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'action' => 'nullable|in:' . implode(',', SettlementActions::ACTIONS),
            'notes' => 'nullable|string',
            'compliance_deadline' => 'nullable|date',
        ];
    }
}
