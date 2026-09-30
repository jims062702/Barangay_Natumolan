<?php

namespace App\Services\Portal;

use App\Models\Population\Zone;
use App\Models\Resident\Resident;
use App\Services\Service\CertificateCatalogue;

/**
 * ONLINE CERTIFICATE REQUEST — by a resident, without signing in, identified
 * by their Barangay Resident ID (the office's request, 2026-09-29).
 *
 * WHO: residents only. The card is read by its QR and checked against the
 * register (ResidentCards); it names the resident, and the request is theirs.
 * Nobody else is offered one: a certificate is issued only to somebody on
 * the register, as at the counter.
 *
 * WHAT IT NEEDS: what the certificate PRINTS about the person — a name and a
 * zone on all of them, and on some the sex, date of birth, civil status,
 * place of birth or address (CertificateCatalogue::personFieldsFor). Those
 * come from the resident's record, the one the ID names. Only what the
 * record does not have is asked, and what they write fills that BLANK on
 * their record (never a value already there — a correction is the Population
 * Office's). The page says which details are on record without showing
 * them: a card photographed by somebody else must not hand over a birthday.
 */
final class CertificateRequests
{
    /** What each detail is called on the page. */
    public const LABELS = [
        'zone_purok' => 'Zone / Purok',
        'gender' => 'Sex',
        'birthdate' => 'Birthdate',
        'civil_status' => 'Civil status',
        'birth_place' => 'Place of birth',
        'address' => 'Address',
    ];

    /**
     * The details this certificate prints about the person, beyond the name
     * the ID already carries — and whether the record has each.
     *
     * @return array<int, array{field: string, label: string, on_record: bool}>
     */
    public static function needs(Resident $resident, string $type): array
    {
        $fields = array_values(array_diff(
            CertificateCatalogue::personFieldsFor($type)['required'],
            ['last_name', 'first_name']
        ));

        return array_map(fn (string $field) => [
            'field' => $field,
            'label' => self::LABELS[$field] ?? ucfirst(str_replace('_', ' ', $field)),
            'on_record' => self::hasOnRecord($resident, $field),
        ], $fields);
    }

    /** The address prints as the zone when there is no street address, as the certificate itself does. */
    private static function hasOnRecord(Resident $resident, string $field): bool
    {
        if ($field === 'address') {
            return trim((string) $resident->address) !== '' || trim((string) $resident->zone_purok) !== '';
        }

        return trim((string) $resident->getAttribute($field)) !== '';
    }

    /** The rules for the details the record is missing — and only those. */
    public static function rulesFor(array $missing): array
    {
        $each = [
            'zone_purok' => ['required', 'string', 'max:100', 'in:' . implode(',', Zone::where('is_active', true)->pluck('name')->all())],
            'gender' => ['required', 'in:Male,Female'],
            'birthdate' => ['required', 'date', 'before:today', 'after:1900-01-01'],
            'civil_status' => ['required', 'in:' . implode(',', Resident::CIVIL_STATUSES)],
            'birth_place' => ['required', 'string', 'max:150'],
            'address' => ['required', 'string', 'max:255'],
        ];

        $rules = [];
        foreach ($missing as $field) {
            if (isset($each[$field])) {
                $rules['details.' . $field] = $each[$field];
            }
        }

        return $rules;
    }

    /**
     * Fills the blanks on the record from what the resident wrote — only
     * blanks, only the fields this certificate needed.
     *
     * @return string[] the labels of what was filled, for the office to see
     */
    public static function fillBlanks(Resident $resident, array $missing, array $details): array
    {
        $changes = [];

        foreach ($missing as $field) {
            $value = $details[$field] ?? null;
            if (! is_string($value) || trim($value) === '' || self::hasOnRecord($resident, $field)) {
                continue;
            }
            $changes[$field] = trim($value);
        }

        if ($changes === []) {
            return [];
        }

        if (isset($changes['birthdate'])) {
            /* A day they wrote themselves, not a census month. */
            $changes['birthdate_is_estimated'] = false;
        }

        $resident->forceFill($changes)->save();

        if (isset($changes['birthdate'])) {
            $resident->reconcileAgeData();
        }

        $filled = array_values(array_intersect(array_keys(self::LABELS), array_keys($changes)));

        return array_map(fn (string $field) => self::LABELS[$field], $filled);
    }
}
