<?php

namespace App\Http\Requests\Portal;

use App\Services\Portal\OnlineCertificate;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A resident's online request.
 *
 * Either ONE certificate, as the chat widget asks for it (service_type,
 * purpose), or SEVERAL in one visit — `items`, each with its own type and
 * purpose — so a resident who needs a clearance and an indigency
 * certificate does not queue twice.
 */
class StoreRequestRequest extends FormRequest
{
    public function rules(): array
    {
        $online = app(OnlineCertificate::class);

        return [
            'items' => 'nullable|array|min:1|max:' . CertificateCatalogue::MAX_IN_TRANSACTION,
            'items.*.service_type' => 'required|string|max:120',
            'items.*.purpose' => 'nullable|string|max:500',
            'items.*.template_fields' => 'nullable|array',
            'items.*.template_fields.business_name' => 'nullable|string|max:150',
            'items.*.template_fields.business_kind' => 'nullable|string|max:150',

            'service_type' => 'required_without:items|nullable|string|max:120',
            /* Not asked where the certificate has no purpose on it — a death
               certification, a marriage license one, a construction clearance. */
            'purpose' => [
                Rule::requiredIf(fn () => ! $this->has('items')
                    && $online->asksPurpose((string) $this->input('service_type'))),
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

    /** Each certificate's purpose, where its paper prints one. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $online = app(OnlineCertificate::class);

            foreach ((array) $this->input('items', []) as $i => $item) {
                $type = (string) ($item['service_type'] ?? '');

                if ($type !== '' && $online->asksPurpose($type) && trim((string) ($item['purpose'] ?? '')) === '') {
                    $v->errors()->add("items.$i.purpose", 'Certificate ' . ($i + 1) . " ($type): please say what it is for.");
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'items.max' => 'At most ' . CertificateCatalogue::MAX_IN_TRANSACTION . ' certificates in one request.',
        ];
    }
}
