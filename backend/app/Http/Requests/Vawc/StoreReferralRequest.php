<?php

namespace App\Http\Requests\Vawc;

use Illuminate\Foundation\Http\FormRequest;

class StoreReferralRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'referral_agency' => 'required|in:PNP WCPD,DSWD,Rural Health Unit,Hospital,Prosecutor,Public Attorney,Shelter,Counseling Service,Child Protection,Other',
            'receiving_person' => 'nullable|string',
            'services_requested' => 'required|string',
            'followup_schedule' => 'nullable|date',
        ];
    }
}
