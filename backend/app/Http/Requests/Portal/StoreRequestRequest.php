<?php

namespace App\Http\Requests\Portal;

use App\Services\Portal\OnlineCertificate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** A resident's online request. */
class StoreRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'service_type' => 'required|string|max:120',
            /* Not asked where the certificate has no purpose on it — a death
               certification, a marriage license one, a construction clearance. */
            'purpose' => [
                Rule::requiredIf(fn () => app(OnlineCertificate::class)->asksPurpose((string) $this->input('service_type'))),
                'nullable',
                'string',
                'max:500',
            ],
            'office' => 'in:Main Office,Population,Health Station',
            /*
             * Present when the request was raised from the chat widget.
             *
             * The request itself is identical whichever door it came
             * through — same record, same pending certificate, same clerk's
             * worklist — so there is one path and not two. What the token
             * adds is a line in the conversation, so a Secretary who is in
             * the middle of helping somebody sees what they just asked for
             * rather than being told about it later.
             */
            'session_token' => 'nullable|string|size:48',
            /*
             * What a business clearance needs that a purpose cannot say: the
             * business's name, and its kind — the kind is what the ordinance
             * prices it by. Only these two are accepted from a resident; see
             * OnlineCertificate::RESIDENT_FIELDS for why nothing else is.
             */
            'template_fields' => 'nullable|array',
            'template_fields.business_name' => 'nullable|string|max:150',
            'template_fields.business_kind' => 'nullable|string|max:150',
        ];
    }
}
