<?php

namespace App\Services\Resident;

/** The register's file layout, shared by the export, the template and the import. */
final class RegisterColumns
{
    /**
     * The columns, in order, and where each one comes from.
     *
     * One list drives the export header, the import parser and the template,
     * so a column can never mean one thing going out and another coming in.
     */
    /**
     * Every field the resident form collects, so a file that goes out can
     * come back in as the same register.
     *
     * `demographic_classification` is the exception and is written out for
     * reading only: it is worked out from the birthdate, so importing it
     * would let a stale file overrule the arithmetic.
     */
    public const COLUMNS = [
        'resident_number', 'record_type', 'last_name', 'first_name', 'middle_name',
        'suffix', 'mother_maiden_name', 'gender', 'birthdate',
        'birthdate_is_estimated', 'birth_place',
        'civil_status', 'spouse_resident_number', 'union_type',
        'occupation', 'contact_number', 'email',
        'household_number', 'zone_purok', 'address', 'residency_status',
        'length_of_residence_years', 'educational_attainment',
        'demographic_classification', 'life_status', 'date_of_death',
        'life_status_note', 'is_active', 'sectors', 'remarks',
    ];
}
