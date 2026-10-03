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
            'items.*.template_fields.deceased_resident_id' => 'nullable|integer|exists:residents,id',
            'items.*.template_fields.deceased_name' => 'nullable|string|max:150',
            'items.*.template_fields.deceased_age' => 'nullable|string|max:20',
            'items.*.template_fields.deceased_address' => 'nullable|string|max:255',
            'items.*.template_fields.date_of_death' => 'nullable|date',
            'items.*.template_fields.time_of_death' => 'nullable|string|max:50',
            'items.*.template_fields.place_of_death' => 'nullable|string|max:255',
            'items.*.template_fields.relationship_to_deceased' => 'nullable|string|max:100',
            'items.*.template_fields.requested_by' => 'nullable|string|max:150',

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
             * prices it by.
             */
            'template_fields' => 'nullable|array',
            'template_fields.business_name' => 'nullable|string|max:150',
            'template_fields.business_kind' => 'nullable|string|max:150',
            'template_fields.deceased_resident_id' => 'nullable|integer|exists:residents,id',
            'template_fields.deceased_name' => 'nullable|string|max:150',
            'template_fields.deceased_age' => 'nullable|string|max:20',
            'template_fields.deceased_address' => 'nullable|string|max:255',
            'template_fields.date_of_death' => 'nullable|date',
            'template_fields.time_of_death' => 'nullable|string|max:50',
            'template_fields.place_of_death' => 'nullable|string|max:255',
            'template_fields.relationship_to_deceased' => 'nullable|string|max:100',
            'template_fields.requested_by' => 'nullable|string|max:150',
        ];
    }

    /** Each certificate's purpose, where its paper prints one. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $online = app(OnlineCertificate::class);
            $userId = $this->user()?->resident_id;

            $checkDeathFields = function ($fields, $prefix) use ($v, $userId) {
                $deceasedId = $fields['deceased_resident_id'] ?? null;
                if (! $deceasedId) {
                    $v->errors()->add($prefix . 'deceased_resident_id', 'Please search and select the deceased resident.');
                } elseif ($userId && (int) $deceasedId === (int) $userId) {
                    $v->errors()->add($prefix . 'deceased_resident_id', 'You cannot request a Certification of Death for yourself.');
                }

                if (empty($fields['date_of_death'])) {
                    $v->errors()->add($prefix . 'date_of_death', 'Date of death is required.');
                } elseif ($fields['date_of_death'] > \App\Support\ManilaTime::today()) {
                    $v->errors()->add($prefix . 'date_of_death', 'Date of death cannot be in the future.');
                }

                if (empty($fields['time_of_death']) || trim($fields['time_of_death']) === '') {
                    $v->errors()->add($prefix . 'time_of_death', 'Time of death is required.');
                }

                if (empty($fields['place_of_death']) || trim($fields['place_of_death']) === '') {
                    $v->errors()->add($prefix . 'place_of_death', 'Place of death is required.');
                }

                if (empty($fields['relationship_to_deceased']) || trim($fields['relationship_to_deceased']) === '') {
                    $v->errors()->add($prefix . 'relationship_to_deceased', 'Relationship to the deceased is required.');
                }
            };

            if ($this->input('service_type') === 'Certification of Death') {
                $checkDeathFields($this->input('template_fields', []), 'template_fields.');
            }

            foreach ((array) $this->input('items', []) as $i => $item) {
                $type = (string) ($item['service_type'] ?? '');

                if ($type !== '' && $online->asksPurpose($type) && trim((string) ($item['purpose'] ?? '')) === '') {
                    $v->errors()->add("items.$i.purpose", 'Certificate ' . ($i + 1) . " ($type): please say what it is for.");
                }

                if ($type === 'Certification of Death') {
                    $checkDeathFields($item['template_fields'] ?? [], "items.$i.template_fields.");
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
