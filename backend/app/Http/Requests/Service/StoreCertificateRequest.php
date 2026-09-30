<?php

namespace App\Http\Requests\Service;

use App\Models\Service\ServiceRequest;
use App\Services\Service\CertificateCatalogue;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCertificateRequest extends FormRequest
{
    /** Said wherever a certificate is asked for somebody not on the register. */
    public const NOT_ON_REGISTER = 'A certificate is issued only to a resident on the barangay\'s register. '
        . 'Please coordinate with the Population Office to register the resident first.';

    public function rules(): array
    {
        return [
            /*
             * Somebody on the Population Office's register, always.
             *
             * A certificate used to be fileable for a person "not yet
             * listed", from details typed at the counter. It is not any more:
             * the barangay certifies facts about its residents, and the
             * register is where who they are is kept — so the person is
             * listed first, and the paper comes from their record.
             */
            'resident_id' => 'required|integer|exists:residents,id',
            'unlisted_person' => 'prohibited',
            /* Filed with others in one visit — see ServiceRequest::TRANSACTION_CODE. */
            'transaction_code' => ['nullable', 'string', 'regex:' . ServiceRequest::TRANSACTION_CODE],
            // Optional: when omitted this is a walk-in and we create the request.
            'service_request_id' => 'nullable|exists:service_requests,id',
            'certificate_type' => 'required|in:' . implode(',', CertificateCatalogue::typeNames()),
            /* Only where the printed form has one — see 'asks_purpose'. */
            'purpose' => [
                Rule::requiredIf(fn () => CertificateCatalogue::asksPurpose((string) $this->input('certificate_type'))),
                'nullable',
                'string',
            ],
            /*
             * What the printed form asks for and the register does not know
             * — the hour of a death, a partner's name, the work applied for.
             * Free-form by key because the keys differ per type; the
             * catalogue says which ones this type expects.
             */
            'template_fields' => 'nullable|array',
            // Which documentary requirements the applicant presented.
            'requirements_checklist' => 'nullable|array',
            'requirements_checklist.*.item' => 'required|string',
            'requirements_checklist.*.presented' => 'required|boolean',
            'fee_amount' => 'nullable|numeric|min:0',
            'is_exempt' => 'boolean',
            'exemption_reason' => 'nullable|string',
            /*
             * The number a device already printed, when it had no line.
             *
             * Optional and never trusted on its face: it is checked against
             * the caller's own office series and against the unique index.
             * Accepted here only so the paper in the resident's hand and the
             * row in the register carry the same number.
             */
            'certificate_number' => 'nullable|string|max:64',
            /* What a device that printed with no line also sends. Ignored
               unless certificate_number is too. */
            'reference_number' => 'nullable|string|max:64',
            'offline_status' => 'nullable|in:Processing,Ready to Claim,Released',
            /* The counter photograph, taken on a device with no line. */
            'photo_data' => 'nullable|string',
            'printed_at' => 'nullable|date',
            'released_at' => 'nullable|date',
        ];
    }

    public function messages(): array
    {
        return [
            'resident_id.required' => 'Choose the resident. ' . self::NOT_ON_REGISTER,
            'resident_id.exists' => 'That resident is not on the register. ' . self::NOT_ON_REGISTER,
            'unlisted_person.prohibited' => self::NOT_ON_REGISTER,
        ];
    }
}
