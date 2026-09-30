<?php

namespace App\Http\Requests\Service;

use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Several certificates for one resident, filed at the counter in one visit.
 *
 * Each item is what a single filing takes (see StoreCertificateRequest) —
 * its own type, purpose, answers and fee. The resident, and the visit they
 * belong to, are said once.
 */
class StoreCertificateBatchRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'resident_id' => 'required|integer|exists:residents,id',
            'unlisted_person' => 'prohibited',
            'transaction_code' => ['nullable', 'string', 'regex:' . ServiceRequest::TRANSACTION_CODE],
            'items' => 'required|array|min:1|max:' . CertificateCatalogue::MAX_IN_TRANSACTION,
            'items.*.certificate_type' => 'required|in:' . implode(',', CertificateCatalogue::typeNames()),
            'items.*.purpose' => 'nullable|string|max:255',
            'items.*.template_fields' => 'nullable|array',
            'items.*.requirements_checklist' => 'nullable|array',
            'items.*.fee_amount' => 'nullable|numeric|min:0',
            'items.*.is_exempt' => 'boolean',
            'items.*.exemption_reason' => 'nullable|string|max:255',
        ];
    }

    /** A purpose where the printed form has one — the same rule as one filing. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            foreach ((array) $this->input('items', []) as $i => $item) {
                $type = (string) ($item['certificate_type'] ?? '');

                if ($type !== '' && CertificateCatalogue::asksPurpose($type)
                    && trim((string) ($item['purpose'] ?? '')) === '') {
                    $v->errors()->add("items.$i.purpose", 'Certificate ' . ($i + 1) . " ($type): enter the purpose — it is printed on it.");
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'resident_id.required' => 'Choose the resident. ' . StoreCertificateRequest::NOT_ON_REGISTER,
            'resident_id.exists' => 'That resident is not on the register. ' . StoreCertificateRequest::NOT_ON_REGISTER,
            'unlisted_person.prohibited' => StoreCertificateRequest::NOT_ON_REGISTER,
            'items.required' => 'Add at least one certificate.',
            'items.max' => 'At most ' . CertificateCatalogue::MAX_IN_TRANSACTION . ' certificates in one transaction.',
        ];
    }
}
