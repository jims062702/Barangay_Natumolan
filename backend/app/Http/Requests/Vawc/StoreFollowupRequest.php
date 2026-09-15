<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

class StoreFollowupRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'followup_date' => 'required|date',
            'followup_type' => 'required|in:Home Visit,Office Visit,Phone Call',
            'safety_status' => 'required|in:Safe,At Risk,Critical,Unknown',
            'bpo_compliance' => 'in:Compliant,Violated,No BPO',
            'referral_attended' => 'nullable|boolean',
            'services_received' => 'nullable|string',
            'notes' => 'nullable|string',
            'next_followup_date' => 'nullable|date',
            'closure_recommended' => 'boolean',
        ];
    }
}
