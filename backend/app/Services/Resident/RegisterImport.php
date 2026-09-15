<?php

namespace App\Services\Resident;

use App\Models\Household\Household;
use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
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
 */
final class RegisterImport
{
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

        // Strip the BOM Excel writes back, or the first column name never
        // matches and every row looks like it is missing a surname.
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $header);

        foreach (['last_name', 'first_name'] as $needed) {
            if (!in_array($needed, $header, true)) {
                return ['error' => 'The file needs at least a "' . $needed
                    . '" column. Download the template if you are not sure of the columns.'];
            }
        }

        $households = Household::pluck('id', 'household_number');
        $rows = [];
        $line = 1;

        while (($data = $nextRow()) !== false) {
            $line++;

            // Excel leaves trailing blank lines in almost every saved file.
            if (count(array_filter($data, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue;
            }

            $rows[] = $this->planRow(
                array_combine($header, array_pad(array_slice($data, 0, count($header)), count($header), null)),
                $line,
                $households
            );
        }

        if ($handle) {
            fclose($handle);
        }

        return [
            'rows' => $rows,
            'summary' => [
                /* Distinct: ten members of one new household is ONE household. */
                'new_households' => count(array_unique(array_filter(
                    array_column($rows, 'new_household')
                ))),
                'total' => count($rows),
                'create' => count(array_filter($rows, fn ($r) => $r['action'] === 'create' && !$r['problems'])),
                'update' => count(array_filter($rows, fn ($r) => $r['action'] === 'update' && !$r['problems'])),
                'errors' => count(array_filter($rows, fn ($r) => $r['problems'] !== [])),
            ],
        ];
    }

    /**
     * Does what the plan described: households first, then the people, then
     * the couples.
     *
     * @return array{created: int, updated: int, skipped: int, households: int, couples: int}
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

        /* Line number to the resident it became, for the spouse pass below. */
        $written = [];

        DB::transaction(function () use (
            $parsed, &$created, &$updated, &$skipped, &$households, &$couples, &$written
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
        });

        /*
         * Household member counts are kept on the household row, and the
         * import has just changed who is in several of them.
         */
        Household::whereIn('id', Resident::whereNotNull('household_id')->distinct()->pluck('household_id'))
            ->each(fn (Household $h) => $h->update(['total_members' => $h->residents()->count()]));

        return compact('created', 'updated', 'skipped', 'households', 'couples');
    }

    /** What one row means, and what is wrong with it. */
    private function planRow(array $cell, int $line, $households): array
    {
        $get = function (string $key) use ($cell) {
            $value = trim((string) ($cell[$key] ?? ''));

            return $value === '' ? null : $value;
        };

        $problems = [];
        $values = [];

        foreach (['last_name', 'first_name', 'middle_name', 'suffix', 'mother_maiden_name',
                  'birth_place', 'occupation', 'contact_number', 'email', 'zone_purok',
                  'address', 'educational_attainment', 'life_status_note', 'remarks'] as $plain) {
            if ($get($plain) !== null) { $values[$plain] = $get($plain); }
        }

        if (!$get('last_name') || !$get('first_name')) {
            $problems[] = 'A first name and a last name are required.';
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

        $choice('gender', ['Male', 'Female', 'Other']);
        $choice('civil_status', ['Single', 'Married', 'Widowed', 'Separated', 'Divorced']);
        $choice('residency_status', ['Permanent', 'Temporary', 'Migrant']);
        $choice('life_status', ['Alive', 'Deceased']);
        $choice('record_type', ['Resident', 'Non-resident']);

        /* ---- dates ---- */
        foreach (['birthdate', 'date_of_death'] as $dateKey) {
            $raw = $get($dateKey);
            if ($raw === null) { continue; }

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

        $sectors = $get('sectors')
            ? array_values(array_filter(array_map('trim', preg_split('/[;,]/', $get('sectors')))))
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
        } elseif ($get('birthdate') && isset($values['birthdate'])) {
            $existing = Resident::whereRaw('LOWER(last_name) = ?', [strtolower($get('last_name') ?? '')])
                ->whereRaw('LOWER(first_name) = ?', [strtolower($get('first_name') ?? '')])
                ->whereDate('birthdate', $values['birthdate'])
                ->first();
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
            'name' => trim(($get('first_name') ?? '') . ' ' . ($get('last_name') ?? '')),
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
            /* The household this row would bring into being, if any. */
            'new_household' => $newHousehold,
            /* What the household would be given, from this same row. */
            'new_household_details' => $newHousehold === null ? null : [
                'zone_purok' => $get('zone_purok'),
                'street_address' => $get('address'),
            ],
            'problems' => $problems,
        ];
    }
}
