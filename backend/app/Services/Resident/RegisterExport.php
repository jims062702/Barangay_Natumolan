<?php

namespace App\Services\Resident;

use App\Models\Resident\Marriage;
use App\Models\Resident\Resident;
use App\Support\Xlsx;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Getting the register OUT as a spreadsheet — and the empty template for bringing one in.
 *
 * CSV by default, Excel on request. CSV is the one every spreadsheet on
 * earth opens, it survives being emailed and edited by somebody with no
 * software the barangay chose, and a file the office cannot open is not a
 * backup — so it stays the default. But a clerk who is going to open this in
 * Excel and nothing else should not have to answer an import dialogue about
 * delimiters every time, so .xlsx is there for them.
 *
 * One field is the resident's own: occupation. A file may bring one in for
 * somebody being created — a restore with every job blank is not a restore —
 * and is ignored for somebody already on the register, because changing that
 * is the resident's to do from their portal.
 *
 * Two rules the whole thing turns on:
 *
 *   - EXPORT is everything the register holds about a person, in one row.
 *   - IMPORT never guesses. A row that matches nobody is a new resident; a
 *     row that matches somebody is an update ONLY where the file actually
 *     says something. Blank cells leave the register alone, because "I did
 *     not fill this column in" and "this person has no occupation" arrive
 *     as exactly the same empty cell — and treating them alike is how a
 *     round-trip through Excel quietly empties half a register.
 */
final class RegisterExport
{
    /**
     * The whole register as a download, in whichever of the two formats.
     *
     * Streamed rather than built in memory: a barangay of twenty thousand is
     * a twenty-thousand-row file, and holding it all before sending the
     * first byte is how the request times out on the machine that needs it
     * most.
     */
    public function download(Request $request): StreamedResponse
    {
        $query = Resident::with([
                'household:id,household_number',
                /* The sectors they are in now — not the brackets they grew out of. */
                'sectors' => fn ($q) => $q->where('is_active', true),
                /* Only the number is written out — an id means nothing to
                   whoever opens this file somewhere else. */
                'spouse:id,resident_number',
            ])
            ->whereNull('merged_into_id')
            ->orderBy('id');

        // Non-residents are on the register so families could be recorded
        // whole; they are not the barangay's population and are left out
        // unless asked for.
        if ($request->input('record_type') === Resident::NON_RESIDENT) {
            $query->where('record_type', Resident::NON_RESIDENT);
        } elseif (!$request->boolean('include_non_residents')) {
            $query->bonafide();
        }

        if ($request->filled('zone_purok')) {
            $query->where('zone_purok', $request->input('zone_purok'));
        }

        /*
         * The same name matching the registry list uses, so what a clerk
         * sees on screen and what comes out of the file are the same people.
         * A search that means one thing in the list and another in the export
         * is worse than no search at all.
         */
        if ($request->filled('search')) {
            $query->nameSearch($request->input('search'));
        }

        if ($request->filled('sector')) {
            $query->whereHas('sectors', fn ($q) => $q->where('sector_type', $request->input('sector'))
                ->where('is_active', true));
        }

        $stem = 'barangay-natumolan-residents-' . now()->format('Y-m-d');

        /*
         * Every open union, in one query, as resident id to its type.
         *
         * Both sides of a union are recorded on one row, so each row is read
         * into the map twice — once for each person in it.
         */
        $unionTypes = [];

        foreach (Marriage::open()->get(['resident_id', 'spouse_id', 'union_type']) as $union) {
            $unionTypes[$union->resident_id] = $union->union_type;
            $unionTypes[$union->spouse_id] = $union->union_type;
        }

        /*
         * ONE definition of a row, whichever format asked for it. Two copies
         * of twenty-six columns is two copies that drift, and the day they
         * do, the CSV and the spreadsheet quietly disagree about what the
         * register says.
         */
        $cells = fn (Resident $r) => [
            $r->resident_number,
            $r->record_type,
            $r->last_name,
            $r->first_name,
            $r->middle_name,
            $r->suffix,
            $r->mother_maiden_name,
            $r->gender,
            $r->birthdate?->toDateString(),
            /*
             * A birthdate from the census has no day — it is the end of the
             * month it was given for. Losing this flag turns an approximate
             * date into one the register would swear to.
             */
            $r->birthdate_is_estimated ? 'Yes' : 'No',
            $r->birth_place,
            $r->nationality,
            $r->civil_status,
            $r->spouse?->resident_number,
            $unionTypes[$r->id] ?? null,
            $r->occupation,
            $r->contact_number,
            $r->email,
            $r->household?->household_number,
            $r->zone_purok,
            $r->address,
            $r->residency_status,
            $r->length_of_residence_years,
            $r->educational_attainment,
            $r->registered_voter_in,
            $r->demographic_classification,
            $r->life_status,
            $r->date_of_death?->toDateString(),
            $r->life_status_note,
            $r->is_active ? 'Yes' : 'No',
            // Semicolons, because a comma inside a CSV cell is a quoting
            // problem waiting to be mis-parsed by whatever opens this next.
            $r->sectors->pluck('sector_type')->join('; '),
            $r->remarks,
        ];

        if ($request->input('format') === 'xlsx') {
            return response()->stream(function () use ($query, $cells) {
                Xlsx::write(RegisterColumns::COLUMNS, function (callable $row) use ($query, $cells) {
                    $query->chunk(500, function ($residents) use ($row, $cells) {
                        foreach ($residents as $resident) {
                            $row($cells($resident));
                        }
                    });
                });
            }, 200, [
                'Content-Type' => Xlsx::CONTENT_TYPE,
                'Content-Disposition' => 'attachment; filename="' . $stem . '.xlsx"',
            ]);
        }

        return response()->stream(function () use ($query, $cells) {
            $out = fopen('php://output', 'w');

            /*
             * A UTF-8 BOM, for Excel.
             *
             * Without it Excel on Windows reads the file as the system
             * codepage and every ñ in the register turns into mojibake — on
             * a Philippine name list that is most of the interesting rows.
             */
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, RegisterColumns::COLUMNS);

            $query->chunk(500, function ($residents) use ($out, $cells) {
                foreach ($residents as $resident) {
                    fputcsv($out, $cells($resident));
                }
            });

            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $stem . '.csv"',
        ]);
    }

    /** An empty file with the right header, so nobody has to guess the columns. */
    public function template(): StreamedResponse
    {
        return response()->stream(function () {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, RegisterColumns::COLUMNS);

            // One filled row, as an example. It is obvious enough to delete
            // and specific enough to copy.
            fputcsv($out, [
                '', 'Resident', 'Dela Cruz', 'Juan', 'Reyes', '', 'Santos',
                'Male', '1992-07-20', 'Tagoloan, Misamis Oriental', 'Married',
                'Driver', '+63 917 0000000', '', '', 'Purok 1', '', 'Permanent',
                '20', 'High School Graduate', '', 'Alive', '', 'Yes',
                'Adult; 4Ps Household', '',
            ]);

            fclose($out);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="resident-import-template.csv"',
        ]);
    }
}
