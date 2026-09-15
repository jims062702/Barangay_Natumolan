<?php

namespace App\Support;

/**
 * What the barangay issues, and what the ordinance says it costs.
 *
 * Two things used to be wrong here, and they were the same mistake twice.
 *
 * The first: one price per certificate type. The ordinance does not price a
 * Barangay Clearance — it prices what the clearance is FOR. The same sheet of
 * paper is ₱200 for a Mayor's Permit, ₱100 for work abroad and ₱30 for local
 * employment. A single 'Barangay Clearance' => 50 was not a rounding error;
 * it was the wrong shape, and no amount of correcting the number fixes it.
 *
 * The second: the office was charged with knowing the schedule by heart.
 * There are seventy-odd amounts in the ordinance of 18 January 2020 and they
 * lived in a ring binder. This is that binder, typed once.
 *
 * The wording of each item is the ordinance's own, including where the
 * ordinance misspells it (SAWMILLL, BODEGA/SOTRAGE, TRANPORT). A fee schedule
 * that quietly corrects the law it quotes is a fee schedule nobody can check
 * against the paper — so the spelling stays and the tidying does not happen.
 */
class CertificateCatalogue
{
    /*
    |--------------------------------------------------------------------------
    | What a Barangay Clearance costs, which is: it depends what it is for
    |--------------------------------------------------------------------------
    */
    public const CLEARANCE_PURPOSES = [
        'Employment Abroad' => 100,
        "Mayor's Permit" => 200,
        'Passport' => 50,
        'Loan Purposes' => 40,
        'Motor Installment' => 30,
        'Employment for Local and other Purposes' => 30,
        'Filing Fee' => 20,
    ];

    /*
    |--------------------------------------------------------------------------
    | Business clearance, by the kind of business
    |--------------------------------------------------------------------------
    |
    | Thirty kinds, ₱25 to ₱750. A trisikad and a sawmill are not the same
    | ask of the barangay and the ordinance does not pretend they are.
    */
    public const BUSINESS_KINDS = [
        'Buy and Sell Falcata & Gemelina' => 750,
        'Catering' => 500,
        'Const./Consultant & Electric works' => 500,
        'Sawmill, Boxmaker & Wood Processing' => 500,
        'Construction Supply' => 500,
        'Pharmaceuticals' => 500,
        'Human Services (Emp. Agency)' => 500,
        'Real Estate Lessor' => 500,
        'Swift Food Lab' => 500,
        'Stock Yard' => 500,
        'Food Processing' => 500,
        'SAG Supplier' => 500,
        'Recapping Plant' => 500,
        'Eatery' => 200,
        'Ohsor Grille' => 100,
        'Sound System' => 100,
        'Labor Contractor' => 100,
        'CHB Making' => 100,
        'General Merchandise' => 100,
        'Internet Café (per unit)' => 100,
        'Junk Shop' => 100,
        'Bodega/Storage' => 100,
        'Furniture/Sewing Machine/Repair Shop' => 100,
        'Auto Shop' => 100,
        'Vulcanizing Shop' => 100,
        'Lumber Yard' => 100,
        'Trimotor' => 50,
        'Softdrinks Retailer' => 50,
        'Sari-sari Store' => 50,
        'Trisikad' => 25,
    ];

    /*
    |--------------------------------------------------------------------------
    | The certifications the ordinance names one by one
    |--------------------------------------------------------------------------
    */
    public const CERTIFICATION_FEES = [
        'Transport Animals — Pig and Goat (per head)' => 50,
        'Transport Animals — Cow, Carabao and Horse (per head)' => 100,
        'Lumber (Transport)' => 100,
        'Affidavit of Loss' => 50,
        'Has Business/Income' => 50,
        'Farms' => 50,
        'Building Permit' => 50,
        'Birth Certificate' => 40,
        'Certificate to File Action' => 200,
        'Residency' => 40,
        'Certificate for Titling' => 100,
        'Garage — Residential' => 100,
        'Garage — Commercial' => 500,
    ];

    /** What the ordinance charges for a certification it did not name. */
    public const OTHER_CERTIFICATION_FEE = 30;

    /**
     * The documentary stamp the barangay affixes to every certificate.
     *
     * Charged on top of the fee, on every certificate, and recorded
     * separately — see the migration that added the column. It is never
     * waived: a fee exemption (an indigent, a first-time jobseeker) removes
     * the ordinance's fee, not the stamp that goes on the paper.
     *
     * One number, here, for the barangay to change.
     */
    public const DOCUMENTARY_STAMP = 30;

    /*
    |--------------------------------------------------------------------------
    | The documents themselves
    |--------------------------------------------------------------------------
    |
    | 'fee' is the flat amount; where it is null the fee comes from a CHOICE
    | the clerk makes — 'fee_from' names which table, and 'fee_field' which of
    | the document's own fields carries the answer. That is the whole reason
    | this class replaced a flat array.
    |
    | 'fields' are what the printed form asks for that the register does not
    | already know. Everything the register knows — name, zone, birthdate,
    | civil status — is filled from the resident record and is not listed.
    |
    | 'letterhead' picks the paper: 'plain' is the seal and the four heading
    | lines; 'council' adds the sidebar of officials down the left, which only
    | the Barangay Clearance carries; 'half' is the half-sheet, two to a page.
    |
    | 'asks_purpose' is false where the printed form has no purpose on it.
    | Checked against every template the office supplied: the death
    | certification is fixed "for DEATH CERTIFICATE", the marriage one "for
    | his/her Marriage License application", the construction clearance "for
    | whatever purpose it may serve best". Asking for a purpose there made
    | the clerk type something that was then printed nowhere.
    */
    public const TYPES = [
        'Barangay Clearance' => [
            'fee' => null,
            'fee_from' => 'clearance',
            'fee_field' => 'purpose',
            'office' => 'Punong Barangay',
            'letterhead' => 'council',
            /* In the order the sheet prints them: the kagawad's line, then the OR. */
            'fields' => ['officer_of_the_day', 'or_number'],
        ],

        'Barangay Clearance with Picture' => [
            /*
             * The same clearance and the same fee — the picture is not a
             * different document and the ordinance does not price it as one.
             * It is the version where the barangay photographs the applicant
             * at the counter and the print carries the photo and two
             * thumbmark boxes.
             */
            'fee' => null,
            'fee_from' => 'clearance',
            'fee_field' => 'purpose',
            'office' => 'Punong Barangay',
            'letterhead' => 'council',
            'needs_photo' => true,
            'fields' => ['officer_of_the_day', 'or_number'],
        ],

        'Business Barangay Clearance' => [
            'fee' => null,
            'fee_from' => 'business',
            'fee_field' => 'business_kind',
            'office' => 'Punong Barangay',
            'letterhead' => 'council',
            'fields' => ['business_name', 'business_kind', 'officer_of_the_day', 'or_number'],
        ],

        'Certificate of Residency' => [
            'fee' => 40,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            /*
             * Years, because the form says so and the register knows it.
             * The paper template reads "resides at the said place for how
             * many years" — the blank was never cut into it, so it printed
             * as a sentence with no number in it. RBIM Q35 has the answer.
             */
            'fields' => ['years_of_residence'],
        ],

        'Certificate of Residency with Birth Details' => [
            'fee' => 40,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            /* Father and mother sit in the table above the years line. */
            'fields' => ['father_name', 'mother_name', 'years_of_residence'],
        ],

        'Certificate of Indigency' => [
            /* The ordinance: NO PAYMENT. Not a discount — a zero. */
            'fee' => 0,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => [],
        ],

        'Certification of Death' => [
            'fee' => 0,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'asks_purpose' => false,
            /*
             * The requester and their relationship are asked for because the
             * paper template hardcodes "upon the request of HER SON" — which
             * printed those two words for a father whose daughter came in.
             */
            'fields' => [
                'deceased_name', 'deceased_age', 'deceased_address',
                'date_of_death', 'time_of_death', 'place_of_death',
                /* "upon the request of her son JUAN" — the relationship prints first. */
                'relationship_to_deceased', 'requested_by',
            ],
        ],

        'Certificate of Appearance' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            /* The only one issued by the Sanggunian rather than the PB. */
            'office' => 'Sangguniang Barangay',
            'letterhead' => 'half',
            'fields' => ['position', 'station', 'dates_appeared'],
        ],

        'Certification of Common Law Partner' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => ['partner_name', 'years_together'],
        ],

        'Certification of Oneness of Name' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => ['name_on_payroll', 'correct_name'],
        ],

        'Certification for Marriage License' => [
            /*
             * Written as a form, which it was not.
             *
             * The paper template is one person's document with the facts
             * typed into it: WIDOW, a church and barangay death certificate
             * from Barangay Aguining in Bohol, "his late husband". Printed
             * for anybody else it stated things about them that were untrue.
             * The particulars are fields now.
             */
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'asks_purpose' => false,
            'fields' => ['civil_status_stated', 'attached_documents', 'late_spouse_name'],
        ],

        'Barangay Construction Clearance' => [
            /* The ordinance's Building Permit line. */
            'fee' => 50,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'asks_purpose' => false,
            /*
             * The work is a field. The paper template is titled for
             * construction and then clears only ELECTRICAL INSTALLATION,
             * which is fixed text — so a fence or a extension printed as an
             * electrical job.
             */
            'fields' => ['applicant_name', 'work_applied_for'],
        ],

        'First-Time Jobseeker' => [
            /*
             * Free by national law — RA 11261 — not by the barangay's
             * ordinance, which is why it is not in the schedule above and
             * why the amount is not the barangay's to change.
             */
            'fee' => 0,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => [],
        ],

        /*
         * Two the system already offered and the ordinance does not name.
         *
         * They are kept rather than dropped: residents can already ask for
         * them through the portal, and deleting a type is how a request
         * quietly becomes unfulfillable. But the price changed, and that is
         * the barangay's call to confirm — "Certificate of Low or No Income"
         * was free here, and under the ordinance only Indigency and a Death
         * Certificate are free. Anything else it does not name is ₱30.
         */
        'Good Moral Character' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => [],
        ],

        'Certificate of Low or No Income' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => [],
        ],

        'Other Certification' => [
            'fee' => self::OTHER_CERTIFICATION_FEE,
            'office' => 'Punong Barangay',
            'letterhead' => 'plain',
            'fields' => ['body'],
        ],
    ];

    /**
     * Service types that produce a certificate, mapped to the certificate
     * type. Non-certificate services (blotter, complaints, …) are not here.
     */
    public const SERVICE_TYPES = [
        'Barangay Clearance' => 'Barangay Clearance',
        'Barangay Certificate' => 'Other',
        'Certificate of Residency' => 'Certificate of Residency',
        'Certificate of Indigency' => 'Certificate of Indigency',
        'First-Time Jobseeker Certification' => 'First-Time Jobseeker',
        'Certificate of Low or No Income' => 'Certificate of Low or No Income',
        'Business Barangay Clearance' => 'Business Barangay Clearance',
        'Good Moral Character' => 'Good Moral Character',
        'Other Barangay Service' => 'Other',
    ];

    /**
     * Which of the document's own answers sets its price.
     *
     * For most types nothing does and the fee is flat. For a clearance it is
     * the purpose — which the form already asks for as its own column — and
     * for a business clearance it is the kind of business, which lives in
     * the template fields.
     */
    public static function priceDecidingAnswer(string $type, array $data): ?string
    {
        $field = self::TYPES[$type]['fee_field'] ?? null;

        if (! $field) {
            return null;
        }

        return $field === 'purpose'
            ? ($data['purpose'] ?? null)
            : ($data['template_fields'][$field] ?? null);
    }

    /** Every type name, for a validation rule. */
    public static function typeNames(): array
    {
        return array_keys(self::TYPES);
    }

    /**
     * What this document costs, given what it is for.
     *
     * Returns null when the type prices by a choice and the choice has not
     * been made — the caller must ask rather than guess, because guessing
     * here means charging a resident the wrong amount.
     */
    public static function feeFor(string $type, ?string $choice = null): ?int
    {
        $spec = self::TYPES[$type] ?? null;

        if (! $spec) {
            return null;
        }

        if ($spec['fee'] !== null) {
            return $spec['fee'];
        }

        if ($choice === null || $choice === '') {
            return null;
        }

        $table = match ($spec['fee_from']) {
            'clearance' => self::CLEARANCE_PURPOSES,
            'business' => self::BUSINESS_KINDS,
            default => [],
        };

        /*
         * A purpose the schedule does not name falls to the ordinance's own
         * catch-all — "And Other Certification Fees ₱30" — rather than to
         * zero. Zero would let an unrecognised word make a document free.
         */
        return $table[$choice] ?? self::OTHER_CERTIFICATION_FEE;
    }

    /** The extra questions this document asks beyond the register. */
    public static function fieldsFor(string $type): array
    {
        return self::TYPES[$type]['fields'] ?? [];
    }

    /** Whether the printed form has a purpose on it — see 'asks_purpose'. */
    public static function asksPurpose(string $type): bool
    {
        return (bool) (self::TYPES[$type]['asks_purpose'] ?? true);
    }

    public static function needsPhoto(string $type): bool
    {
        return (bool) (self::TYPES[$type]['needs_photo'] ?? false);
    }

    /**
     * The whole thing, shaped for the counter screen: what may be issued,
     * what each asks for, and every amount the ordinance sets.
     */
    public static function forClient(): array
    {
        return [
            'types' => collect(self::TYPES)
                ->map(fn (array $spec, string $name) => [
                    'name' => $name,
                    'fee' => $spec['fee'],
                    'fee_from' => $spec['fee_from'] ?? null,
                    'fee_field' => $spec['fee_field'] ?? null,
                    'office' => $spec['office'],
                    'letterhead' => $spec['letterhead'],
                    'needs_photo' => (bool) ($spec['needs_photo'] ?? false),
                    'asks_purpose' => self::asksPurpose($name),
                    'fields' => $spec['fields'],
                ])
                ->values()
                ->all(),
            'clearance_purposes' => self::CLEARANCE_PURPOSES,
            'business_kinds' => self::BUSINESS_KINDS,
            'certification_fees' => self::CERTIFICATION_FEES,
            'other_certification_fee' => self::OTHER_CERTIFICATION_FEE,
            /* Added to every certificate's fee, so the counter can quote
               the whole amount rather than the fee alone. */
            'documentary_stamp' => self::DOCUMENTARY_STAMP,
        ];
    }
}
