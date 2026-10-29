<?php

namespace App\Services\Resident;

use App\Models\Household\Household;
use App\Models\Population\Zone;
use App\Models\Resident\Marriage;
use App\Models\Rbim\CensusMember;
use App\Models\Resident\Resident;
use App\Models\Account\User;
use App\Services\Account\PortalAccount;
use App\Support\Nationality;
use App\Support\XlsxReader;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Bringing a register file IN.
 *
 * Import never guesses. A row that matches nobody is a new resident; a row
 * that matches somebody is an update ONLY where the file actually says
 * something. Blank cells leave the register alone, because "I did not fill
 * this column in" and "this person has no occupation" arrive as exactly the
 * same empty cell — and treating them alike is how a round-trip through
 * Excel quietly empties half a register.
 *
 * Three kinds of file arrive here, and all three are read:
 *
 *   - the system's own template and export (last_name, gender, birthdate…);
 *   - a sheet headed with the RBIM form's questions ("Q3. SEX");
 *   - the RBIM ENCODING sheet the enumerators' encoder produces — one row per
 *     household member, headed lname, fname, sex, birthdate, subQ5, street,
 *     popcomno… with every answer written as the form's code.
 */
final class RegisterImport
{
    /**
     * Columns where 98 and 99 are real values and not "not answered".
     * Identifiers only — a resident or household number can end in anything.
     */
    private const LITERAL = ['resident_number', 'household_number', 'spouse_resident_number',
        'contact_number', 'email'];

    /**
     * Other people's headings, as the register names them.
     *
     * Headings are lower-cased and stripped of their question number and
     * punctuation first, so "Q3. SEX", "SEX" and "sex" all arrive as `sex` —
     * and land here.
     */
    private const ALIASES = [
        /* The RBIM form's own questions. */
        'surname' => 'last_name',
        'sex' => 'gender',
        'date_of_birth' => 'birthdate',
        'place_of_birth' => 'birth_place',
        'marital_status' => 'civil_status',
        'highest_level_of_education_completed' => 'educational_attainment',
        'education' => 'educational_attainment',
        'type_of_resident' => 'residency_status',
        'length_of_stay_in_the_barangay' => 'length_of_residence_years',
        'relationship_to_hhh' => 'relationship',
        'relationship_to_household_head' => 'relationship',
        /* Q32. "In what barangay is ___ a registered voter?" */
        'registered_voter' => 'registered_voter_in',

        /*
         * The RBIM encoding sheet's columns — lname, fname, civilstatus and
         * the rest, run together and lower-case, exactly as that sheet is
         * headed. Its "birthdate" is kept as `birthdate` on purpose: there it
         * holds only the MONTH, and subQ5 beside it the year. planRow() puts
         * the two together.
         */
        'lname' => 'last_name',
        'fname' => 'first_name',
        'mname' => 'middle_name',
        'civilstatus' => 'civil_status',
        'levelofeducation' => 'educational_attainment',
        'placeofbirth' => 'birth_place',
        'subq5' => 'birth_year',
        'subq6' => 'birth_province',
        'typeofresident' => 'residency_status',
        /* Spelled as the sheet spells it, and as it should have been. */
        'lenghtinbarangay' => 'length_of_residence_years',
        'lengthinbarangay' => 'length_of_residence_years',
        /*
         * The POPCOM number is the household's number on the RBIM — every
         * member of one household carries the same one (18A001A). It is
         * used as the register's household number, so a second import of
         * the same sheet finds the households the first one made.
         */
        'popcomno' => 'household_number',
        'registeredvoter' => 'registered_voter_in',
        'dissability' => 'disability',
        'houseno' => 'house_number',
        'rmflrblockno' => 'unit_number',
    ];

    /**
     * Civil statuses the RBIM form knows and the register does not.
     *
     * The register offers Single, Married, Widowed and Separated
     * (Resident::CIVIL_STATUSES). Living-in, Divorced and Unknown have no
     * equivalent there — the same line CensusRegistration draws when a census
     * sheet is registered — and a wrong civil status is worse than none. So
     * they are left blank, and the preview SAYS so rather than dropping them
     * quietly.
     */
    private const NO_CIVIL_EQUIVALENT = ['Living-in', 'Divorced', 'Unknown'];

    /**
     * Q36's type of resident, in the register's own words.
     *
     * Non-migrant has always lived here; a Migrant moved in and has stayed
     * past six months; a Transient has been here less than that.
     */
    private const RESIDENT_TYPE_TO_STATUS = [
        'Non-migrant' => 'Permanent',
        'Migrant' => 'Migrant',
        'Transient' => 'Temporary',
    ];

    /**
     * What each kind of note MEANS, said once.
     *
     * The preview used to print the whole sentence on every line it applied
     * to — "Civil status Living-in has no equivalent on the register…" a
     * hundred and six times over — and the handful of notes that needed
     * somebody to act were lost in it. Each kind now has one heading and
     * one explanation, and the lines are listed under it.
     *
     * key => [heading, what happened and what to do]
     */
    private const NOTE_KINDS = [
        'living_in' => ['Living-in (Q8)',
            'The register records a live-in couple as partners, not as a civil status — the same '
            . 'as when the office links a couple by hand. Civil status is left "Not recorded", and '
            . 'where the household head and the head\'s partner both answered Living-in, the two '
            . 'are linked as live-in partners.'],
        'divorced' => ['Divorced (Q8)',
            'The register has no Divorced civil status, so it is left "Not recorded". Set it on '
            . 'their record if they are Separated.'],
        'no_sex' => ['Sex not filled in (Q3 is 0)',
            'Imported with Sex blank. Fill it in on their record.'],
        'birth_month' => ['Birth month is not 1 to 12 (Q5)',
            'The day was probably typed in the month box. Date of birth left blank — fill it in '
            . 'on their record.'],
        'birth_year' => ['Birth year is not a real year (Q5)',
            'Date of birth left blank — fill it in on their record.'],
        'birth_part' => ['Only part of the date of birth (Q5)',
            'A year with no month, or a month with no year. Date of birth left blank — fill it in '
            . 'on their record.'],
        'zone' => ['Zone not on the barangay\'s list',
            'Zone left blank. Add the zone to the barangay\'s list first, then import this same file again '
            . 'and it fills in — nobody is added twice.'],
        'pwd' => ['Person with disability (Q29)',
            'Tagged PWD, with the disability the census recorded. Add their PWD ID number on '
            . 'their record once it has been seen — the census does not carry it.'],
        'duplicate' => ['Same person twice on the sheet',
            'The same name and date of birth are on another line, so they are imported ONCE — '
            . 'from the first line. Where the two lines give different households, check which '
            . 'household is right: the second is not joined.'],
        'nationality' => ['Nationality is not 1 or 2 (Q7)',
            'Left blank. Q7 is 1 for Filipino, or 2 and then the nationality ("2, Japanese"). '
            . 'Set it on their record.'],
        'solo_parent' => ['Registered Solo Parent (Q30)',
            'Tagged Solo Parent. Add the number from their Solo Parent ID on their record — the '
            . 'census does not carry it.'],
    ];

    /** Q2 codes that make somebody family of the head: Son 3, Daughter 4. */
    private const CHILD_OF_HEAD = [3, 4];

    /**
     * The barangay's zones, by a spelling that ignores case and spaces:
     * "zone18a" => "Zone 18A". Loaded once per file.
     *
     * @var array<string, string>
     */
    private array $zones = [];

    /**
     * A heading, as the register names the column it belongs to.
     *
     * "Q3. SEX" → sex → gender. "Q11. HIGHEST LEVEL OF EDUCATION COMPLETED"
     * → educational_attainment. The template's own headings pass straight
     * through, since they are already in this form.
     */
    private static function columnFor(string $heading): string
    {
        $h = strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $heading)));

        /*
         * The question number comes off only when something SEPARATES it
         * from the question — "Q3. SEX", "Q11 HIGHEST…". The encoding sheet
         * runs its own headings together instead: "q55sex" is the sex of a
         * household member who died (Q55), and read as "sex" it would
         * overwrite every living resident's Sex with a 0.
         */
        $h = preg_replace('/^q\d+[a-c]?(?:\s*[\.\:\)\-]\s*|\s+)/', '', $h);
        $h = trim(preg_replace('/[^a-z0-9]+/', '_', $h), '_');

        return self::ALIASES[$h] ?? $h;
    }

    /**
     * An RBIM code, if that is what the cell holds.
     *
     * "01" and "1" are the same code, and so is "1.0" (a numeric cell can
     * come out of a workbook with its decimal still on). The encoding sheet
     * sometimes writes the label after it — "0 - None", "0 - No Education" —
     * and that is the code 0 as well. Anything else is not a code at all.
     */
    private static function codeOf(string $raw): ?int
    {
        return preg_match('/^(\d{1,2})(?:\.0+)?(?:\s*[-–:]\s*\S.*)?$/u', $raw, $found)
            ? (int) $found[1]
            : null;
    }

    /**
     * A name as the register writes it.
     *
     * The encoding sheet is typed in capitals — ACA, CHUCHIELEE — and the
     * register is not: the same person would otherwise appear as "James
     * Gasang" on one line of a list and "CHUCHIELEE ACA" on the next. Only an
     * all-capitals name is changed; one typed in mixed case ("McArthur",
     * "dela Cruz") is left exactly as the office typed it.
     */
    private static function nameCase(string $name): string
    {
        if (! preg_match('/\p{L}/u', $name) || mb_strtoupper($name) !== $name) {
            return $name;
        }

        return mb_convert_case(mb_strtolower($name), MB_CASE_TITLE);
    }

    /**
     * The register's zone for "ZONE 18 A", "Zone 18A" or "18A", or null when
     * the barangay has no zone by that name.
     */
    private function zoneFor(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $key = preg_replace('/[^a-z0-9]/', '', strtolower($raw));

        /* "Z-4" is how the encoders shorten Zone 4. */
        $key = preg_replace('/^z(?=\d)/', 'zone', $key);

        return $this->zones[$key] ?? $this->zones['zone' . $key] ?? null;
    }

    /**
     * Whether a cell NAMES a zone — "ZONE 6B", "Z-4", "ZONE 18" — whether or
     * not the barangay has one by that name. Such a cell is never an address.
     */
    private static function namesAZone(string $raw): bool
    {
        return (bool) preg_match('/^\s*z(?:one)?\s*[-.]?\s*\d{1,2}\s*-?\s*[a-z]?\s*$/i', $raw);
    }

    /**
     * The zone a POPCOM household number begins with, as the encoders write
     * it: 18A001A and 18A0086 (Zone 18A), Z4-001A (Zone 4), Z6B0024 (Zone
     * 6B), Z-12037 (Zone 12). Null for a number in any other shape — the
     * register's own HH-2026-… numbers included.
     */
    private static function zoneInPopcom(?string $number): ?string
    {
        if ($number === null
            || ! preg_match('/^(?:Z-?(\d{1,2}[A-Z]?)-?|(\d{1,2}[A-Z]))\d{3,4}[A-Z]?$/i', $number, $found)) {
            return null;
        }

        return strtoupper($found[1] !== '' ? $found[1] : $found[2]);
    }

    /**
     * Q5's year, as a four-digit year — or null when it cannot honestly be
     * one.
     *
     * Encoders sometimes type two digits: 86, 90. Which century is settled
     * by the AGE on the same line, at the date of the visit: 86 for somebody
     * 39 in 2025 is 1986, not 2086 or 1886. Two answers on the sheet agreeing
     * is not a guess. When they do not agree — a year of "12" for somebody
     * 58 — there is no year, only a mistake, and it is left for the office.
     */
    private function birthYear(?string $raw, ?string $age, ?string $visited): ?int
    {
        if ($raw === null) {
            return null;
        }

        $thisYear = (int) now()->year;

        if (preg_match('/^\d{4}(\.0+)?$/', $raw)) {
            $year = (int) $raw;

            return $year >= 1900 && $year <= $thisYear ? $year : null;
        }

        if (! preg_match('/^\d{2}$/', $raw)) {
            return null;
        }

        $recent = 2000 + (int) $raw;
        $older = 1900 + (int) $raw;
        $years = is_numeric($age) ? (int) floor((float) $age) : null;

        /* No age to settle it: the later century, unless that is still to come. */
        if ($years === null) {
            return $recent <= $thisYear ? $recent : $older;
        }

        $asOf = preg_match('/\b(19|20)\d{2}\b/', (string) $visited, $found) ? (int) $found[0] : $thisYear;

        foreach ([$recent, $older] as $candidate) {
            /* A year either side: whether this year's birthday had come yet
               on the day of the visit. */
            if ($candidate <= $thisYear && abs($asOf - $candidate - $years) <= 1) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Turns the uploaded file into a row-by-row plan.
     *
     * Every row comes back with what would happen to it and what is wrong
     * with it, so the preview and the import read the same thing and cannot
     * disagree.
     */
    public function plan(UploadedFile $upload): array
    {
        $grid = [];
        $isSpreadsheet = strtolower($upload->getClientOriginalExtension()) === 'xlsx';

        if ($isSpreadsheet) {
            try {
                $grid = XlsxReader::rows($upload->getRealPath());
            } catch (\Throwable $failure) {
                return ['error' => $failure->getMessage()];
            }
        }

        $handle = $isSpreadsheet ? null : fopen($upload->getRealPath(), 'r');

        if (! $isSpreadsheet && ! $handle) {
            return ['error' => 'That file could not be opened.'];
        }

        /*
         * One reader for both kinds of file, so everything past this point —
         * the header check, the row plan, the preview — cannot treat a
         * spreadsheet differently from a CSV.
         */
        $at = 0;
        $nextRow = function () use ($handle, &$grid, &$at, $isSpreadsheet) {
            if ($isSpreadsheet) {
                return $at < count($grid) ? $grid[$at++] : false;
            }

            return fgetcsv($handle);
        };

        $header = $nextRow();

        if (! $header) {
            return ['error' => 'The file is empty.'];
        }

        /* The BOM Excel writes back is stripped inside columnFor(), or the
           first column name never matches and every row looks like it is
           missing a surname. RBIM headings are translated there too. */
        $header = array_map(fn ($h) => self::columnFor((string) $h), $header);

        /*
         * A name, one way or the other: separate columns (the template's
         * last_name and first_name, or the encoding sheet's lname and fname),
         * or the RBIM form's single "Q1. NAME" written "Surname, First Name,
         * Middle Name" — split per row in planRow().
         */
        $separate = in_array('last_name', $header, true) && in_array('first_name', $header, true);

        if (! $separate && ! in_array('name', $header, true)) {
            return ['error' => 'The file needs a name — "last_name" and "first_name" columns '
                . '(or the RBIM sheet\'s "lname" and "fname"), or one "Q1. NAME" column written '
                . 'Surname, First Name, Middle Name. Download the template if you are not sure of the columns.'];
        }

        $households = Household::pluck('id', 'household_number');
        $this->zones = Zone::pluck('name')
            ->mapWithKeys(fn ($name) => [preg_replace('/[^a-z0-9]/', '', strtolower($name)) => $name])
            ->all();
        $rows = [];
        $line = 1;

        while (($data = $nextRow()) !== false) {
            $line++;

            // Excel leaves trailing blank lines in almost every saved file.
            if (count(array_filter($data, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue;
            }

            /*
             * Column by column rather than array_combine: two headings that
             * mean the same thing must not have the LATER one silently win.
             * The first that says something does.
             */
            $cells = [];
            foreach ($header as $i => $key) {
                $value = $data[$i] ?? null;

                if (! array_key_exists($key, $cells) || trim((string) $cells[$key]) === '') {
                    $cells[$key] = $value;
                }
            }

            $rows[] = $this->planRow($cells, $line, $households);
        }

        if ($handle) {
            fclose($handle);
        }

        /*
         * The same person twice on one sheet.
         *
         * The office's own RBIM file carried twenty-three people encoded
         * twice — a family entered under Z6B0020 and again under Z6B020A,
         * the same household typed two ways — and each became two records on
         * the register. Same surname, first name and date of birth, with a
         * middle name that agrees, is one person: imported once, from the
         * first line, and the later line says which it repeats. Without a date of birth two
         * namesakes cannot be told apart, so nothing is merged on a name.
         */
        $seen = [];
        foreach ($rows as $i => $row) {
            $v = $row['values'];

            if ($row['problems'] !== [] || empty($v['birthdate']) || empty($v['last_name']) || empty($v['first_name'])) {
                continue;
            }

            $key = mb_strtolower($v['last_name'] . '|' . $v['first_name'] . '|' . $v['birthdate']);

            /*
             * The middle name as encoders write it twice: "N." one line and
             * "Naldo" the next, "Ocado" and "Ochabo". The same initial — or
             * one line without any — is the same person; a different initial
             * is somebody else who shares a name and a birthday.
             */
            $initial = mb_strtolower(mb_substr(trim((string) ($v['middle_name'] ?? '')), 0, 1));
            $firstIndex = null;
            foreach ($seen[$key] ?? [] as [$index, $theirs]) {
                if ($initial === '' || $theirs === '' || $initial === $theirs) {
                    $firstIndex = $index;
                    break;
                }
            }

            if ($firstIndex === null) {
                $seen[$key][] = [$i, $initial];
                continue;
            }

            $first = $rows[$firstIndex];
            $detail = 'same as line ' . $first['line']
                . ($first['household_number'] !== $row['household_number']
                    ? ' — but under household ' . ($row['household_number'] ?? 'none')
                        . ', not ' . ($first['household_number'] ?? 'none')
                    : '');

            $rows[$i]['action'] = 'duplicate';
            $rows[$i]['duplicate_of'] = $first['line'];
            $rows[$i]['new_household'] = null;
            $rows[$i]['notes'][] = self::NOTE_KINDS['duplicate'][0] . ' — ' . $detail;
            $rows[$i]['note_keys'][] = 'duplicate';
            $rows[$i]['note_details'][] = $detail;
        }

        /* The notes by kind, for rows that will import. A refused row is
           shown with its problems instead. */
        $groups = [];
        foreach ($rows as $row) {
            if ($row['problems'] !== []) {
                continue;
            }

            foreach ($row['note_keys'] as $i => $key) {
                $groups[$key] ??= [
                    'key' => $key,
                    'title' => self::NOTE_KINDS[$key][0],
                    'explanation' => self::NOTE_KINDS[$key][1],
                    'lines' => [],
                ];
                $groups[$key]['lines'][] = [
                    'line' => $row['line'],
                    'name' => $row['name'],
                    'detail' => $row['note_details'][$i],
                ];
            }
        }

        return [
            'rows' => $rows,
            'note_groups' => array_values($groups),
            'summary' => [
                /* Distinct: ten members of one new household is ONE household. */
                'new_households' => count(array_unique(array_filter(
                    array_column($rows, 'new_household')
                ))),
                'total' => count($rows),
                'create' => count(array_filter($rows, fn ($r) => $r['action'] === 'create' && !$r['problems'])),
                'update' => count(array_filter($rows, fn ($r) => $r['action'] === 'update' && !$r['problems'])),
                'errors' => count(array_filter($rows, fn ($r) => $r['problems'] !== [])),
                /* Imported once already, from an earlier line. */
                'duplicates' => count(array_filter($rows, fn ($r) => $r['action'] === 'duplicate')),
                /* Imported, but with an answer the register had no place for. */
                'noted' => count(array_filter($rows, fn ($r) => ($r['notes'] ?? []) !== [] && $r['problems'] === [])),
            ],
        ];
    }

    /**
     * Does what the plan described: households first, then the people, then
     * the couples and families.
     *
     * @return array{created: int, updated: int, skipped: int, households: int, couples: int, heads: int, children: int, tagged: int}
     */
    public function apply(array $parsed): array
    {
        $created = 0; $updated = 0; $skipped = 0;

        /*
         * All of it or none of it. A file that fails halfway leaves the
         * register in a state nobody chose and nobody can describe — worse
         * than the import simply not having happened.
         */
        $households = 0;
        $couples = 0;
        $heads = 0;
        $children = 0;
        $tagged = 0;

        /* Line number to the resident it became, for the family passes below. */
        $written = [];

        DB::transaction(function () use (
            $parsed, &$created, &$updated, &$skipped, &$households, &$couples, &$heads, &$children, &$tagged, &$written
        ) {
            /*
             * Households first, and once each.
             *
             * Ten members of one new household are ten rows naming the same
             * number; created row by row that is ten households, nine of them
             * empty. Made here, every row that names it finds the same one.
             */
            $made = [];

            foreach ($parsed['rows'] as $row) {
                $number = $row['new_household'] ?? null;

                if ($number === null || $row['problems'] !== [] || isset($made[$number])) {
                    continue;
                }

                /* firstOrCreate, not create: two imports of the same file must
                   not leave two households wearing one number. */
                $household = Household::firstOrCreate(
                    ['household_number' => $number],
                    [
                        'zone_purok' => $row['new_household_details']['zone_purok'] ?? null,
                        'street_address' => $row['new_household_details']['street_address'] ?? null,
                        'total_members' => 0,
                        'notes' => 'Created by an import on ' . now()->toDateString() . '.',
                    ]
                );

                $made[$number] = $household->id;

                if ($household->wasRecentlyCreated) {
                    $households++;
                }
            }

            foreach ($parsed['rows'] as $row) {
                if ($row['problems'] !== []) { $skipped++; continue; }

                /* Already brought in from the line it repeats. */
                if ($row['action'] === 'duplicate') { continue; }

                $values = $row['values'];

                /* A row that named a household not on the register gets the
                   one just made for it. */
                if (($row['new_household'] ?? null) !== null) {
                    $values['household_id'] = $made[$row['new_household']] ?? null;
                }
                $sectors = $values['sectors'] ?? [];
                unset($values['sectors']);

                if ($row['action'] === 'update' && $row['resident_id']) {
                    $resident = Resident::find($row['resident_id']);
                    if (!$resident) { $skipped++; continue; }

                    /*
                     * A resident owns their own occupation, and a file that
                     * rewrites everybody's is the office editing it — the
                     * rule going out the back door. It may still be SET on
                     * somebody being created below, or a register rebuilt
                     * from a backup would come back with every job blank.
                     */
                    unset($values['occupation']);

                    // Only what the file actually said — see the class comment.
                    $resident->fill($values)->save();
                    $updated++;
                    $written[$row['line']] = $resident;
                } else {
                    $values['resident_number'] = $values['resident_number']
                        ?? Resident::nextNumber();

                    $resident = Resident::create($values);
                    $created++;
                    $written[$row['line']] = $resident;
                }

                foreach ($sectors as $sector) {
                    $resident->sectors()->firstOrCreate(
                        ['sector_type' => $sector],
                        ['enrolled_date' => now()->toDateString()]
                    );
                }

                /*
                 * The age brackets, by the register's own rule — what puts an
                 * imported seventy-year-old on the Senior Citizen list and a
                 * three-year-old under Children Under Five, the day they are
                 * imported rather than whenever somebody next opens them.
                 */
                $resident->reconcileAgeData();
            }

            /*
             * The couples, now that both halves of every one of them exist.
             *
             * A spouse named but not in the file and not on the register is
             * left alone rather than refused: the office may be importing one
             * purok at a time, and the partner arrives with the next file.
             */
            foreach ($parsed['rows'] as $row) {
                $number = $row['spouse_number'] ?? null;

                if ($number === null || $row['problems'] !== []) {
                    continue;
                }

                $person = $written[$row['line']] ?? null;
                $spouse = Resident::where('resident_number', $number)->first();

                if (! $person || ! $spouse || $person->id === $spouse->id) {
                    continue;
                }

                /* Already married to each other — importing the same file
                   twice must not open a second union for one couple. */
                if ((int) $person->fresh()->spouse_id === $spouse->id) {
                    continue;
                }

                $person->marryTo($spouse, null, $row['union_type'] ?? 'Married');
                $couples++;
            }

            $family = $this->familiesFrom($parsed['rows'], $written);
            $heads += $family['heads'];
            $couples += $family['couples'];
            $children += $family['children'];

            $tagged += self::tagFromCensus($parsed['rows'], $written);
        });

        /*
         * Household member counts are kept on the household row, and the
         * import has just changed who is in several of them.
         */
        Household::whereIn('id', Resident::whereNotNull('household_id')->distinct()->pluck('household_id'))
            ->each(fn (Household $h) => $h->update(['total_members' => $h->residents()->count()]));

        /*
         * Auto-provision portal accounts for imported/updated residents who have an
         * email and are eligible (age >= 18, bona fide), or sync their existing user email.
         */
        $provisioned = 0;
        foreach ($written as $person) {
            if (!$person || !$person->email) {
                continue;
            }

            // Sync user account if email or name changed
            $account = User::where('resident_id', $person->id)->first();
            if ($account) {
                $accountName = trim(($person->first_name ?? '') . ' ' . ($person->last_name ?? ''));
                $userUpdates = [];
                if ($accountName !== '' && $account->name !== $accountName) {
                    $userUpdates['name'] = $accountName;
                }
                if ($account->email !== $person->email) {
                    $userUpdates['email'] = $person->email;
                }
                if ($userUpdates !== []) {
                    $account->update($userUpdates);
                }
                continue;
            }

            // Provision portal account for eligible resident (bona fide, aged 18+)
            $res = PortalAccount::provision($person, auth()->id(), sendEmail: false);
            if ($res['created']) {
                $provisioned++;
            }
        }

        return compact('created', 'updated', 'skipped', 'households', 'couples', 'heads', 'children', 'tagged', 'provisioned');
    }

    /**
     * The Q29/Q30 sector tags, after the family is linked.
     *
     * After, because Solo Parent is refused to anybody partnered on the
     * register — the rule SectorController holds a clerk to — and whether
     * they are partnered is only known once the couples are made.
     *
     * Only ever ADDS. A tag already on the record, active or taken off by
     * the office, is left as it is: importing the same sheet again must not
     * put back a tag somebody removed on purpose.
     *
     * @return int tags added
     */
    public static function tagFromCensus(array $rows, array $written): int
    {
        $added = 0;

        foreach ($rows as $row) {
            $person = $written[$row['line']] ?? null;

            if (! $person || $row['problems'] !== [] || ($row['rbim_tags'] ?? []) === []) {
                continue;
            }

            $person->refresh();

            foreach ($row['rbim_tags'] as [$type, $note]) {
                if ($type === 'Solo Parent' && $person->spouse_id) {
                    continue;
                }

                $tag = $person->sectors()->firstOrCreate(
                    ['sector_type' => $type],
                    ['enrolled_date' => now()->toDateString(), 'note' => $note]
                );

                if ($tag->wasRecentlyCreated) {
                    $added++;
                }
            }
        }

        return $added;
    }

    /**
     * Q32's answer in one spelling for this barangay.
     *
     * The encoders wrote Natumolan as NAT., NAT, NATUMOLAN and NAT. TAG. —
     * four ways, and a search for voters here would find one. They are all
     * "Barangay Natumolan", the census form's own words when its box is
     * ticked. NONE is somebody not registered anywhere. Anything else is
     * another place, kept as typed.
     */
    private static function voterPlace(string $raw): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $raw));

        /* Typed twice into one cell — "BALINGSAGBALINGSAG" — is typed once. */
        $half = intdiv(mb_strlen($text), 2);
        if ($half > 2 && mb_strlen($text) % 2 === 0
            && mb_substr($text, 0, $half) === mb_substr($text, $half)) {
            $text = mb_substr($text, 0, $half);
        }

        $key = preg_replace('/[^a-z]/', '', strtolower($text));

        if (in_array($key, ['none', 'no', 'wala', 'notregistered', 'notaregisteredvoter', 'notavoter'], true)) {
            return 'Not a registered voter';
        }

        /*
         * This barangay, however it was spelled: NAT., NATUMOLAN, and the
         * slips a hurried encoder makes — NATMULAN, NATUMOLN, NATUMULAN —
         * with or without "Tagoloan" after it. Judged on the first word
         * only, within two letters of "natumolan".
         */
        $words = preg_split('/[^a-z]+/', strtolower($text), -1, PREG_SPLIT_NO_EMPTY);
        if (in_array($words[0] ?? '', ['brgy', 'barangay'], true)) {
            array_shift($words);
        }
        $first = $words[0] ?? '';

        if ($first === 'nat' || (str_starts_with($first, 'nat') && levenshtein($first, 'natumolan') <= 2)) {
            return 'Barangay Natumolan';
        }

        return $text;
    }

    /**
     * Q2 — relationship to the household head — made into what the register
     * keeps: who heads each household, who the head is married to, and whose
     * children the sons and daughters are.
     *
     * The same reading CensusRegistration gives a census sheet, so a
     * household that arrives by import and one that arrives by census come
     * out the same. Only the unambiguous codes: Head 1, Spouse 2, Son 3,
     * Daughter 4. A grandson is the child of one of the head's children and
     * the sheet does not say which, so he is linked to nobody rather than to
     * the wrong parent.
     *
     * Only ever ADDS. A household that already has a head keeps it — a
     * change of owner has its own form and its own history — and a head
     * already married to someone on the register is not married again.
     *
     * @return array{heads: int, couples: int, children: int}
     */
    private function familiesFrom(array $rows, array $written): array
    {
        $count = ['heads' => 0, 'couples' => 0, 'children' => 0];

        $byHouse = [];
        foreach ($rows as $row) {
            $person = $written[$row['line']] ?? null;

            if (! $person || $row['problems'] !== []) {
                continue;
            }

            $person->refresh();

            if ($person->household_id) {
                $byHouse[$person->household_id][] = ['row' => $row, 'person' => $person];
            }
        }

        foreach ($byHouse as $householdId => $members) {
            $headLines = array_values(array_filter($members, fn ($m) => ($m['row']['relationship'] ?? null) === 1));

            $headRow = null;
            $head = null;

            if (count($headLines) > 0) {
                ['row' => $headRow, 'person' => $head] = $headLines[0];
            } elseif (count($members) > 0) {
                // Fallback: pick the first adult (age >= 18) or the oldest/first member
                $adults = array_values(array_filter($members, function ($m) {
                    $bday = $m['person']->birthdate;
                    return $bday && $bday->age >= 18;
                }));
                if (count($adults) > 0) {
                    ['row' => $headRow, 'person' => $head] = $adults[0];
                } else {
                    ['row' => $headRow, 'person' => $head] = $members[0];
                }
            }

            if (! $head) {
                continue;
            }

            $household = Household::find($householdId);

            if ($household && ! $household->household_head_id) {
                /* Through the hand-over, so the house's history has a
                   readable beginning — as when one is made by hand. */
                $household->handOverTo($head);
                $count['heads']++;
            }

            $spouseLine = collect($members)->first(fn ($m) => ($m['row']['relationship'] ?? null) === 2
                && $m['person']->id !== $head->id);
            $spouse = $spouseLine['person'] ?? null;

            if ($spouse) {
                $head->refresh();
                $spouse->refresh();

                if (! $head->spouse_id && ! $spouse->spouse_id) {
                    /* Q2 says WHO; Q8 says what kind of union. Both Living-in
                       is a couple of partners, not a marriage. */
                    $liveIn = ($headRow['marital_code'] ?? null) === 3
                        && ($spouseLine['row']['marital_code'] ?? null) === 3;

                    $head->marryTo($spouse, null, $liveIn ? Marriage::LIVE_IN : 'Married');
                    $count['couples']++;
                    $head->refresh();
                }

                /* A spouse line whose person turned out married to somebody
                   else is not made a parent of the head's children. */
                if ((int) $head->spouse_id !== $spouse->id) {
                    $spouse = null;
                }
            }

            foreach ($members as ['row' => $row, 'person' => $child]) {
                if (! in_array($row['relationship'] ?? null, self::CHILD_OF_HEAD, true) || $child->id === $head->id) {
                    continue;
                }

                $childRole = Resident::roleLabel($child->gender, 'child');
                $linked = false;

                foreach (array_filter([$head, $spouse]) as $parent) {
                    if ($parent->id === $child->id) {
                        continue;
                    }

                    $result = $parent->children()->syncWithoutDetaching([$child->id => [
                        'parent_role' => Resident::roleLabel($parent->gender, 'parent'),
                        'child_role' => $childRole,
                    ]]);

                    $linked = $linked || $result['attached'] !== [];
                }

                if ($linked) {
                    $count['children']++;
                }
            }
        }

        return $count;
    }

    /** What one row means, and what is wrong with it. */
    private function planRow(array $cell, int $line, $households): array
    {
        /* By reference: the RBIM name split below writes the separate name
           columns into $cell, and a copy captured here would never see them. */
        $get = function (string $key) use (&$cell) {
            $value = trim((string) ($cell[$key] ?? ''));

            /*
             * The RBIM form's "not answered" marks — 99 for a question that
             * was skipped (Q11 for a toddler, Q31 for anyone under sixty), 98
             * for "don't know / none" — and an encoder's N/A. On the register
             * each is a blank, never the number: an education of "99", a
             * length of residence of 98 years. "99.0" too, the same cell out
             * of a numeric column.
             */
            if (preg_match('/^(?:(98|99)(\.0+)?|n\/a)$/i', $value) && ! in_array($key, self::LITERAL, true)) {
                return null;
            }

            return $value === '' ? null : $value;
        };

        $problems = [];
        $values = [];
        /*
         * Things the preview should SAY but that do not stop the row: an RBIM
         * answer the register has no place for, so it was left blank. A row
         * that silently loses an answer is how a register ends up disagreeing
         * with the sheet it came from and nobody can say why.
         */
        $notes = [];
        $noteKeys = [];
        $noteDetails = [];
        $note = function (string $key, string $detail = '') use (&$notes, &$noteKeys, &$noteDetails) {
            $notes[] = self::NOTE_KINDS[$key][0] . ($detail !== '' ? ' — ' . $detail : '');
            $noteKeys[] = $key;
            $noteDetails[] = $detail;
        };

        /*
         * The RBIM form's single name column, split.
         *
         * "Q1. NAME: Surname, First Name, Middle Name or Middle Initial" — one
         * cell. Only split on commas: without them "Dela Cruz Juan" cannot be
         * told apart from "Juan Dela Cruz", and guessing would register a
         * person under the wrong surname.
         */
        if ($get('last_name') === null && $get('first_name') === null && $get('name') !== null) {
            $parts = array_map('trim', explode(',', $get('name')));

            if (count($parts) >= 2 && $parts[0] !== '' && $parts[1] !== '') {
                $cell['last_name'] = $parts[0];
                $cell['first_name'] = $parts[1];
                if (! empty($parts[2])) {
                    $cell['middle_name'] = $parts[2];
                }
            } else {
                $problems[] = 'Write the name as Surname, First Name, Middle Name — with commas — '
                    . 'so the surname cannot be mistaken for a first name.';
            }
        }

        foreach (['last_name', 'first_name', 'middle_name', 'suffix', 'mother_maiden_name',
                  'birth_place', 'occupation', 'contact_number', 'email',
                  'address', 'life_status_note', 'remarks'] as $plain) {
            if ($get($plain) !== null) { $values[$plain] = $get($plain); }
        }

        /*
         * Q7 — 1 Filipino, 2 and what they are ("2, Japanese"). Anything else
         * is not guessed at: left blank, and the preview says so.
         */
        if ($get('nationality') !== null) {
            $nationality = Nationality::fromSheet($get('nationality'));
            if ($nationality !== null) {
                $values['nationality'] = $nationality;
            } else {
                $note('nationality', '"' . $get('nationality') . '"');
            }
        }

        /* Q32, in one spelling for this barangay however it was typed. */
        if ($get('registered_voter_in') !== null) {
            $values['registered_voter_in'] = self::voterPlace($get('registered_voter_in'));
        }

        foreach (['last_name', 'first_name', 'middle_name', 'mother_maiden_name'] as $name) {
            if (isset($values[$name])) {
                $values[$name] = self::nameCase($values[$name]);
            }
        }

        if (!$get('last_name') || !$get('first_name')) {
            $problems[] = 'A first name and a last name are required.';
        }

        /*
         * Q6 on the encoding sheet is two cells — the town (placeofbirth) and
         * the province or city beside it (subQ6): TALUSAN, BALINGASAG. One
         * place of birth on the register.
         */
        if ($get('birth_province') !== null) {
            $values['birth_place'] = isset($values['birth_place'])
                ? $values['birth_place'] . ', ' . $get('birth_province')
                : $get('birth_province');
        }

        /* ---- the fields with a fixed set of answers ---- */
        $choice = function (string $key, array $allowed) use ($get, &$problems, &$values) {
            $raw = $get($key);
            if ($raw === null) { return; }

            foreach ($allowed as $option) {
                if (strcasecmp($raw, $option) === 0) { $values[$key] = $option; return; }
            }

            $problems[] = ucfirst(str_replace('_', ' ', $key)) . ' "' . $raw
                . '" is not one of: ' . implode(', ', $allowed) . '.';
        };

        /*
         * THE RBIM CODES, READ AS WORDS.
         *
         * An enumerator's sheet holds the form's codes — Sex 1, Marital
         * status 2, Education 05 — and the register holds words. Each coded
         * field takes EITHER: the word as before, or the code, looked up in
         * the SAME codebook the census form uses (CensusMember), so a sheet
         * imported here and a census registered there come out identical.
         *
         * Going out is the other direction and needs nothing: the export
         * writes the register's words ("Male"), never a code.
         */
        $coded = function (string $key, array $codebook) use ($get) {
            $raw = $get($key);
            if ($raw === null) { return null; }
            $code = self::codeOf($raw);

            return $code !== null && isset($codebook[$code]) ? $codebook[$code] : $raw;
        };

        /* Q3. Sex — Male = 1, Female = 2. Only those two: the register's
           column holds nothing else. */
        $sex = $coded('gender', CensusMember::SEXES);

        /*
         * 0 is not a sex; it is the encoder's program leaving the box at its
         * starting value. Those are real people — named, with an age and a
         * birthday — and refusing them would leave them off the register
         * altogether. So they come in with Sex blank, and the office is told.
         */
        if ($sex !== null && self::codeOf($sex) === 0) {
            $note('no_sex');
            $sex = null;
        }

        if ($sex !== null) {
            $match = collect(['Male', 'Female'])->first(fn ($o) => strcasecmp($o, $sex) === 0);
            if ($match) {
                $values['gender'] = $match;
            } else {
                $problems[] = 'Sex "' . $get('gender') . '" is not Male (1) or Female (2).';
            }
        }

        /* Q8. Marital status — Single 1, Married 2, Living-in 3, Widowed 4,
           Separated 5, Divorced 6, Unknown 7. Three of those have no place on
           the register; see NO_CIVIL_EQUIVALENT. */
        $marital = $coded('civil_status', CensusMember::MARITAL_STATUSES);
        $maritalCode = $marital === null ? null : (array_search(
            strtolower($marital),
            array_map('strtolower', CensusMember::MARITAL_STATUSES),
            true
        ) ?: null);
        if ($marital !== null) {
            $match = collect(Resident::CIVIL_STATUSES)->first(fn ($o) => strcasecmp($o, $marital) === 0);
            $none = collect(self::NO_CIVIL_EQUIVALENT)->first(fn ($o) => strcasecmp($o, $marital) === 0);

            if ($match) {
                $values['civil_status'] = $match;
            } elseif ($none === 'Living-in') {
                $note('living_in');
            } elseif ($none === 'Divorced') {
                $note('divorced');
            } elseif ($none) {
                /* Unknown (7): exactly what a blank civil status already says. */
            } else {
                $problems[] = 'Civil status "' . $get('civil_status') . '" is not one of the RBIM codes 1–7 '
                    . 'or: ' . implode(', ', Resident::CIVIL_STATUSES) . '.';
            }
        }

        /* Q11. Highest education — 00 to 13, read as the form's words. The
           register field is free text, so anything that is not a code is
           kept exactly as typed. */
        $education = $coded('educational_attainment', CensusMember::EDUCATION_LEVELS);
        if ($education !== null) {
            $values['educational_attainment'] = $education;
        }

        /* Q36. Type of resident — Non-migrant 1, Migrant 2, Transient 3 —
           or the register's own words. */
        $residency = $coded('residency_status', CensusMember::RESIDENT_TYPES);
        if ($residency !== null) {
            $asType = collect(self::RESIDENT_TYPE_TO_STATUS)
                ->first(fn ($status, $type) => strcasecmp($type, $residency) === 0);
            $asStatus = collect(['Permanent', 'Temporary', 'Migrant'])
                ->first(fn ($o) => strcasecmp($o, $residency) === 0);

            if ($asType ?? $asStatus) {
                $values['residency_status'] = $asType ?? $asStatus;
            } else {
                $problems[] = 'Residency "' . $get('residency_status') . '" is not an RBIM type of resident '
                    . '(1 Non-migrant, 2 Migrant, 3 Transient) or Permanent, Temporary, Migrant.';
            }
        }
        $choice('life_status', ['Alive', 'Deceased']);
        $choice('record_type', ['Resident', 'Non-resident']);

        /* Q2. Relationship to the head — 1 to 22, or the word. Kept for the
           family pass in apply(); nothing on the resident's own row. */
        $relationship = null;
        if ($get('relationship') !== null) {
            $code = self::codeOf($get('relationship'));
            $relationship = $code !== null && isset(CensusMember::RELATIONSHIPS[$code])
                ? $code
                : (array_search(
                    strtolower($get('relationship')),
                    array_map('strtolower', CensusMember::RELATIONSHIPS),
                    true
                ) ?: null);
        }

        /* ---- dates ---- */
        $lastDayOf = function (int $month, int $year): string {
            $day = sprintf('%04d-%02d-%02d', $year, $month, (int) date('t', mktime(0, 0, 0, $month, 1, $year)));

            /* A baby born this month would otherwise be dated in the future. */
            return min($day, now()->toDateString());
        };

        foreach (['birthdate', 'date_of_death'] as $dateKey) {
            $raw = $get($dateKey);

            /*
             * The encoding sheet asks Q5 as two cells: the MONTH under
             * "birthdate" (3) and the YEAR under subQ5 (1975). Put together
             * they are one month-and-year, read exactly like "03/1975" below.
             */
            /*
             * Whenever the FILE has a subQ5 column, "birthdate" is a month —
             * even on a line where the year was left out. Read as a date,
             * a lone "12" is a date the system cannot read, or worse, today.
             * (A whole date typed there after all is read the ordinary way
             * below.)
             *
             * What cannot be made into a date is LEFT BLANK AND SAID, never
             * refused: these are real people on the barangay's own census,
             * and a typing slip in one box is no reason to leave the whole
             * person off the register.
             */
            if ($dateKey === 'birthdate' && array_key_exists('birth_year', $cell)
                && ($raw === null || self::codeOf($raw) !== null)) {
                /* Month 0 is how the encoders' program writes "not filled in". */
                $month = $raw === null ? null : (self::codeOf($raw) ?: null);
                $year = $this->birthYear($get('birth_year'), $get('age'), $get('datevisit'));

                if ($month !== null && $month > 12) {
                    $note('birth_month', 'month "' . $raw . '"');
                } elseif ($get('birth_year') !== null && $year === null) {
                    $note('birth_year', 'year "' . $get('birth_year') . '"'
                        . ($get('age') !== null ? ', but age ' . $get('age') . ' on the sheet' : ''));
                } elseif ($month !== null && $year !== null) {
                    $values['birthdate'] = $lastDayOf($month, $year);
                    $values['birthdate_is_estimated'] = true;
                } elseif ($year !== null) {
                    $note('birth_part', 'year ' . $year . ', no month');
                } elseif ($month !== null) {
                    $note('birth_part', 'month ' . $month . ', no year');
                }
                continue;
            }

            if ($raw === null) { continue; }

            /*
             * Q5 is asked as MONTH AND YEAR — "09/1998". Carbon would read
             * that as something else entirely, so it is taken apart here and
             * placed on the last day of that month, exactly as a census sheet
             * is when it is registered (CensusRegistration::birthdateOf), and
             * marked estimated so a clerk knows it is not off a birth
             * certificate.
             */
            if ($dateKey === 'birthdate' && preg_match('/^(\d{1,2})\s*[\/\-]\s*(\d{4})$/', $raw, $my)) {
                $month = (int) $my[1];
                $year = (int) $my[2];

                if ($month >= 1 && $month <= 12 && $year >= 1900) {
                    $values['birthdate'] = $lastDayOf($month, $year);
                    $values['birthdate_is_estimated'] = true;
                } else {
                    $problems[] = 'Date of birth "' . $raw . '" is not a real month and year.';
                }
                continue;
            }

            try {
                $values[$dateKey] = Carbon::parse($raw)->toDateString();
            } catch (\Throwable) {
                $problems[] = ucfirst(str_replace('_', ' ', $dateKey)) . ' "' . $raw
                    . '" is not a date the system can read. Use YYYY-MM-DD.';
            }
        }

        if ($get('length_of_residence_years') !== null) {
            $values['length_of_residence_years'] = (int) $get('length_of_residence_years');
        }

        $yesNo = fn (string $raw) => in_array(strtolower($raw), ['yes', '1', 'true', 'y'], true);

        if ($get('is_active') !== null) {
            $values['is_active'] = $yesNo($get('is_active'));
        }

        if ($get('birthdate_is_estimated') !== null) {
            $values['birthdate_is_estimated'] = $yesNo($get('birthdate_is_estimated'));
        }

        /*
         * ---- where they live ----
         *
         * The zone, spelled the barangay's way. The encoding sheet writes it
         * under "street" — ZONE 18 A on one line, ZONE 18A on the next — and
         * both are Zone 18A. A street that is not a zone is a street, and
         * goes on the address instead.
         */
        $zone = $get('zone_purok');
        if ($zone !== null) {
            /* A zone the barangay does not have is kept as typed: the
               template has always taken it so, and the office may be
               importing a purok it has not added yet. */
            $values['zone_purok'] = $this->zoneFor($zone) ?? $zone;
        }

        $street = $get('street');
        /* Every zone the line names, in the order they are trusted. */
        $named = [];

        if ($street !== null && ($this->zoneFor($street) !== null || self::namesAZone($street))) {
            $named[] = $street;
            $street = null;
        } elseif ($street !== null && $get('barangay') !== null && strcasecmp(trim($street), $get('barangay')) === 0) {
            /* "NATUMOLAN" under street says only which barangay this is. */
            $street = null;
        }

        /*
         * The POPCOM number begins with the zone — 18A001A is household 001
         * of Zone 18A, Z4-001A of Zone 4. That settles a street of just
         * "ZONE 18" (18A or 18B?), and fills the zone where the street was
         * left blank, which on the office's sheet is most lines.
         */
        $popcomZone = self::zoneInPopcom($get('household_number'));
        if ($popcomZone !== null) {
            $named[] = $popcomZone;
        }

        if (! isset($values['zone_purok'])) {
            foreach ($named as $candidate) {
                if ($this->zoneFor($candidate) !== null) {
                    $values['zone_purok'] = $this->zoneFor($candidate);
                    break;
                }
            }
        }

        /*
         * A zone the sheet names and the barangay does not have. Not made up
         * on the spot — the zone list is what BHWs are assigned from, and a
         * zone that exists only on residents belongs to no BHW — but said,
         * so it can be added and the file imported again to fill it in.
         */
        if (! isset($values['zone_purok']) && $named !== []) {
            $label = preg_match('/(\d{1,2})\s*-?\s*([a-z]?)\s*$/i', (string) ($popcomZone ?? $named[0]), $z)
                ? 'Zone ' . $z[1] . strtoupper($z[2])
                : $named[0];
            $note('zone', $label);
        }

        if (! isset($values['address'])) {
            $address = trim(implode(', ', array_filter([
                $get('unit_number'),
                $get('house_number'),
                $street,
            ])));

            if ($address !== '') {
                $values['address'] = $address;
            }
        }

        /* ---- what the register keeps elsewhere, said rather than dropped ---- */
        /*
         * Q29 and Q30, onto the sector lists — tagged, not merely noted. A
         * note asked the office to add each tag by hand, and a household's
         * PWD member sat on no PWD list meanwhile. The ID numbers are not on
         * the census; the tag's note says so, and the preview does too.
         */
        $tags = [];
        $disability = self::codeOf((string) $get('disability'));
        if ($disability !== null && isset(CensusMember::DISABILITIES[$disability])) {
            $tags[] = ['PWD', CensusMember::DISABILITIES[$disability] . ' (RBIM Q29). PWD ID number not recorded yet.'];
            $note('pwd', CensusMember::DISABILITIES[$disability]);
        }

        if (self::codeOf((string) $get('soloparent')) === 1) {
            $tags[] = ['Solo Parent', 'Registered Solo Parent (RBIM Q30). Solo Parent ID number not recorded yet.'];
            $note('solo_parent');
        }

        /* ---- the household, by its number ---- */
        $newHousehold = null;

        if ($get('household_number') !== null) {
            $id = $households[$get('household_number')] ?? null;

            if ($id === null) {
                /*
                 * Not a problem — a household to be made. Refusing the row
                 * would mean the office has to create the household by hand
                 * before the file will load, which is the import done twice.
                 *
                 * It is named in the plan so the preview can show it, because
                 * one mistyped number would otherwise found a household of
                 * one person that nobody meant to exist.
                 */
                $newHousehold = $get('household_number');
            } else {
                $values['household_id'] = $id;
            }
        }

        /* The age bracket is never read from a file — an export from last
           year says "Child" of somebody who is Youth now. The birthdate
           decides it (reconcileAgeData in apply()). */
        $sectors = $get('sectors')
            ? array_values(array_filter(
                array_map('trim', preg_split('/[;,]/', $get('sectors'))),
                fn ($s) => $s !== '' && ! in_array($s, Resident::AGE_SECTORS, true)
            ))
            : [];

        /*
         * Which resident this is, if any.
         *
         * The number first, because it is the register's own identifier and
         * cannot mean two people. Falling back to name-and-birthdate is a
         * guess, and a wrong guess here OVERWRITES somebody — so it is only
         * made when both agree, and never on a name alone.
         */
        $existing = null;

        if ($get('resident_number')) {
            $existing = Resident::where('resident_number', $get('resident_number'))->first();

            if (!$existing) {
                // Keep the number the file gave: an office importing its own
                // export expects its numbers back, not new ones.
                $values['resident_number'] = $get('resident_number');
            }
        } elseif (isset($values['birthdate'], $values['last_name'], $values['first_name'])) {
            $existing = Resident::whereRaw('LOWER(last_name) = ?', [mb_strtolower($values['last_name'])])
                ->whereRaw('LOWER(first_name) = ?', [mb_strtolower($values['first_name'])])
                ->whereDate('birthdate', $values['birthdate'])
                ->first();
        } elseif (isset($values['last_name'], $values['first_name']) && $newHousehold === null) {
            /*
             * No date of birth to match on.
             *
             * A line like this, imported before, became somebody with no
             * birthdate, in this household (or in none) and this zone —
             * and without this, importing the same sheet a second time made
             * every one of them again. Exactly ONE record fitting all of
             * that is the person; two or more is a guess, and a guess here
             * overwrites somebody, so the line stays new.
             */
            $candidates = Resident::whereNull('merged_into_id')
                ->whereNull('birthdate')
                ->whereRaw('LOWER(last_name) = ?', [mb_strtolower($values['last_name'])])
                ->whereRaw('LOWER(first_name) = ?', [mb_strtolower($values['first_name'])])
                ->when(
                    isset($values['household_id']),
                    fn ($q) => $q->where('household_id', $values['household_id']),
                    fn ($q) => $q->whereNull('household_id')
                )
                ->when(isset($values['zone_purok']), fn ($q) => $q->where('zone_purok', $values['zone_purok']))
                ->limit(2)
                ->get();

            if ($candidates->count() === 1) {
                $existing = $candidates->first();
            }
        }

        if ($get('email') && $existing?->email !== $get('email')) {
            $taken = Resident::where('email', $get('email'))
                ->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))
                ->exists();

            if ($taken) {
                $problems[] = 'The email ' . $get('email') . ' already belongs to another resident.';
            }
        }

        if ($sectors !== []) { $values['sectors'] = $sectors; }

        return [
            'line' => $line,
            'name' => trim(($values['first_name'] ?? '') . ' ' . ($values['last_name'] ?? '')),
            /* As the sheet writes it, to say where a repeated line put somebody. */
            'household_number' => $get('household_number'),
            'action' => $existing ? 'update' : 'create',
            'resident_id' => $existing?->id,
            'matched_number' => $existing?->resident_number,
            'values' => $values,
            /*
             * Left for a second pass. Row 1 can name row 2 as their spouse,
             * and row 2 does not exist yet while row 1 is being read.
             */
            'spouse_number' => $get('spouse_resident_number'),
            'union_type' => $get('union_type') === null
                ? null
                : (strcasecmp($get('union_type'), Marriage::LIVE_IN) === 0
                    ? Marriage::LIVE_IN
                    : 'Married'),
            /* Q2 and Q8's codes, for the family pass. */
            'relationship' => $relationship,
            /* Q29/Q30 sector tags, added once the family is known — see apply(). */
            'rbim_tags' => $tags,
            'marital_code' => $maritalCode,
            /* The household this row would bring into being, if any. */
            'new_household' => $newHousehold,
            /* What the household would be given, from this same row. */
            'new_household_details' => $newHousehold === null ? null : [
                'zone_purok' => $values['zone_purok'] ?? null,
                'street_address' => $values['address'] ?? null,
            ],
            'problems' => $problems,
            'notes' => $notes,
            'note_keys' => $noteKeys,
            'note_details' => $noteDetails,
        ];
    }
}
