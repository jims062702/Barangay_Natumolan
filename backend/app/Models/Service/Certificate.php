<?php

namespace App\Models\Service;

use App\Services\Service\CertificateCatalogue;
use App\Support\SequenceNumber;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Account\User;
use App\Models\Resident\Resident;

class Certificate extends Model
{
    protected $table = 'certificates_clearances';

    /**
     * The counter workflow, in order — three presses from request to hand-over.
     *
     * The resident asks and the CLERK does every step. There is no approve or
     * reject decision anywhere on this line, and no signature step either:
     * the Punong Barangay signs the paper, which is a thing that happens at a
     * desk, not a button someone has to remember to click. Printing IS the
     * moment the document exists and starts heading for the counter, so it
     * lands straight on `Ready to Claim`.
     *
     * The one exit is `Cancelled`, for a request that should never have been
     * filed.
     */
    public const FLOW = [
        'Pending',         // requested online, nobody has started it
        'Processing',      // a clerk accepted it and is preparing the document
        'Ready to Claim',  // printed, signed, waiting on the counter
        'Released',        // handed to the resident
    ];

    public const CANCELLED = 'Cancelled';

    /** Every status the column may hold, including the off-ramp. */
    public const STATUSES = [...self::FLOW, self::CANCELLED];

    protected $fillable = [
        'certificate_number',
        'resident_id',
        'service_request_id',
        'certificate_type',
        'purpose',
        'template_fields',
        'photo_path',
        'requirements_checklist',
        'fee_amount',
        'documentary_stamp',
        'is_exempt',
        'exemption_reason',
        'status',
        'processed_by',
        'processed_at',
        'printed_at',
        'signed_by',
        'signed_at',
        'ready_at',
        'claimed_at',
        'cancel_reason',
        'released_by',
        'released_at',
        'qr_code',
        'reference_number',
        'reprint_count',
    ];

    /* total_amount: the fee plus the stamp — the figure the resident actually
       pays, so no screen has to add the two together and risk forgetting one. */
    protected $appends = ['photo_url', 'total_amount'];

    /**
     * The counter photograph, for the clearance that carries one.
     *
     * Same shape as Official::photo_url, deliberately — one way of turning a
     * stored path into something a page can show.
     */
    /** What the resident pays: the certificate's fee and its documentary stamp. */
    public function getTotalAmountAttribute(): string
    {
        return number_format((float) $this->fee_amount + (float) $this->documentary_stamp, 2, '.', '');
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path
            ? asset(\Illuminate\Support\Facades\Storage::url($this->photo_path))
            : null;
    }

    protected $casts = [
        'template_fields' => 'array',
        'fee_amount' => 'decimal:2',
        'documentary_stamp' => 'decimal:2',
        'is_exempt' => 'boolean',
        'processed_at' => 'datetime',
        'printed_at' => 'datetime',
        'signed_at' => 'datetime',
        'ready_at' => 'datetime',
        'claimed_at' => 'datetime',
        'released_at' => 'datetime',
        'requirements_checklist' => 'array',
    ];

    /** Next sequential certificate number (CERT-YYYY-000001). */
    /**
     * A number series of its own for each office.
     *
     * WHY THE OFFICE IS IN THE NUMBER. A clerk working with no line has to
     * hand over a finished certificate, and a certificate with no number on
     * it is not a document the barangay can issue. The number therefore has
     * to be decided on the device — and the moment two devices decide
     * independently from one shared series, both pick the same next number
     * and two residents walk out holding the same one.
     *
     * Putting the office in the prefix removes the collision rather than
     * guarding against it: no two offices share a series, so there is
     * nothing to collide over, and it holds however long the line is down.
     *
     * This barangay runs ONE DEVICE PER OFFICE, so the office identifies the
     * device exactly. Should a second device ever be added to one office,
     * this is the thing that has to change first — two devices on one
     * prefix would be back to the collision above.
     */
    public const OFFICE_SERIES = [
        'Main Office' => '01',
        'Population' => '02',
        'Health Station' => '03',
        'VAWC' => '04',
        'Lupon' => '05',
        'SK' => '06',
        'Admin' => '07',
    ];

    /** The prefix this office issues under, e.g. `CERT-2026-01-`. */
    public static function seriesPrefix(?string $office): string
    {
        /*
         * An unknown office falls to Main Office's series rather than to a
         * series of its own. A made-up code would be a number nobody can
         * account for later; Main Office is where a walk-in certificate
         * belongs anyway.
         */
        $code = self::OFFICE_SERIES[$office] ?? self::OFFICE_SERIES['Main Office'];

        return 'CERT-' . date('Y') . '-' . $code . '-';
    }

    /** Digits after the series prefix: CERT-2026-01-000123. */
    public const NUMBER_WIDTH = 6;

    public static function nextCertificateNumber(?string $office = null): string
    {
        return SequenceNumber::next(
            'certificates_clearances',
            'certificate_number',
            self::seriesPrefix($office),
            self::NUMBER_WIDTH
        );
    }

    /**
     * Whether a number is one this office's series could have issued.
     *
     * The prefix alone is not enough. CERT-2026-01-9999999999 starts right,
     * and taken as the highest number on file it would leave the series with
     * nowhere to go — every certificate after it refused as "exhausted". So
     * the number must be the prefix and exactly the series' width of digits,
     * and not the all-nines placeholder the series never issues.
     */
    public static function isSeriesNumber(string $number, ?string $office): bool
    {
        $digits = '\\d{' . self::NUMBER_WIDTH . '}';

        return preg_match('/^' . preg_quote(self::seriesPrefix($office), '/') . $digits . '$/', $number) === 1
            && $number !== self::seriesPrefix($office) . str_repeat('9', self::NUMBER_WIDTH);
    }

    /**
     * A new certificate behind a service request.
     *
     * What every certificate raised from a request has in common — its own
     * number and verification reference, the request and the resident it
     * belongs to, and the documentary stamp. What differs (the purpose, the
     * fee, which status it starts in) is the caller's to say.
     */
    public static function raiseFor(ServiceRequest $request, string $type, array $attributes): self
    {
        return self::create([
            'certificate_number' => self::nextCertificateNumber(),
            'reference_number' => self::nextReferenceNumber(),
            'resident_id' => $request->resident_id,
            'service_request_id' => $request->id,
            'certificate_type' => $type,
            /* The documentary stamp, on every certificate — see CertificateCatalogue. */
            'documentary_stamp' => CertificateCatalogue::DOCUMENTARY_STAMP,
            'is_exempt' => false,
            ...$attributes,
        ]);
    }

    /** Next public verification reference number. */
    public static function nextReferenceNumber(): string
    {
        return strtoupper(uniqid('REF-'));
    }

    /**
     * Where this certificate sits on the line (0-based), or null once it has
     * left it. Used to enforce "one step at a time" without a switch in every
     * action.
     */
    public function flowIndex(): ?int
    {
        $index = array_search($this->status, self::FLOW, true);

        return $index === false ? null : $index;
    }

    /** True while the document can still be corrected or cancelled. */
    public function isBeforePrinting(): bool
    {
        return in_array($this->status, ['Pending', 'Processing'], true);
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    /** The clerk who picked the request up off the queue. */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    /** The Punong Barangay / Secretary who signed the printed document. */
    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by');
    }

    public function releaser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }
}
