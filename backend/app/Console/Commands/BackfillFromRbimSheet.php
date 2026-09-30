<?php

namespace App\Console\Commands;

use App\Models\Household\Household;
use App\Models\Resident\Resident;
use App\Services\Resident\RegisterImport;
use Illuminate\Console\Command;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Carries an RBIM sheet's Q7, Q29, Q30 and Q32 onto residents ALREADY imported
 * from it — and nothing else.
 *
 * The first imports noted disabilities and registered solo parents but did
 * not tag them, and had nowhere to put where somebody votes. Importing the
 * sheet again would fix that, and would also write every other answer on it
 * back over whatever the office has corrected since. So this only ADDS:
 *
 *   - the PWD and Solo Parent tags the sheet answers (never one the office
 *     removed, never Solo Parent to somebody partnered on the register)
 *   - "registered voter in", where the resident's record has it blank
 *   - nationality (Q7: 1 Filipino, 2 and what they are), where the record
 *     has none — an answer that is neither code is left for the office
 *
 *   php artisan residents:rbim-backfill "path/to/sheet.xlsx" --dry-run
 */
class BackfillFromRbimSheet extends Command
{
    protected $signature = 'residents:rbim-backfill {file : The RBIM encoding sheet (.xlsx or .csv)} {--dry-run : Say what would be added, add nothing}';

    protected $description = 'Add Q7 (nationality), PWD / Solo Parent tags and Q32 (registered voter) from an RBIM sheet to residents already on the register';

    public function handle(RegisterImport $import): int
    {
        $path = (string) $this->argument('file');

        if (! is_file($path)) {
            $this->error("No such file: {$path}");

            return self::FAILURE;
        }

        $plan = $import->plan(new UploadedFile($path, basename($path), null, null, true));

        if (isset($plan['error'])) {
            $this->error($plan['error']);

            return self::FAILURE;
        }

        $households = Household::pluck('id', 'household_number');
        $written = [];
        $unmatched = 0;
        $ambiguous = 0;

        foreach ($plan['rows'] as $row) {
            /* A repeated line is the same person as an earlier one. */
            if ($row['problems'] !== [] || $row['action'] === 'duplicate') {
                continue;
            }

            $v = $row['values'];
            $resident = $row['resident_id'] ? Resident::find($row['resident_id']) : null;

            /*
             * A line with no usable date of birth matched nobody by name and
             * birthdate. Its household number and name still find it — the
             * import put it in that household — but only when exactly one
             * person answers, never a guess.
             */
            if (! $resident && isset($v['last_name'], $v['first_name']) && $row['new_household'] === null) {
                $householdId = $v['household_id'] ?? null;
                $found = Resident::whereNull('merged_into_id')
                    ->whereRaw('LOWER(last_name) = ?', [mb_strtolower($v['last_name'])])
                    ->whereRaw('LOWER(first_name) = ?', [mb_strtolower($v['first_name'])])
                    ->when($householdId, fn ($q) => $q->where('household_id', $householdId))
                    ->get();

                if ($found->count() === 1) {
                    $resident = $found->first();
                } elseif ($found->count() > 1) {
                    $ambiguous++;
                }
            }

            if (! $resident) {
                $unmatched++;
                continue;
            }

            $written[$row['line']] = $resident;
        }

        $tagsWanted = 0;
        $voterWanted = 0;
        $nationalityWanted = 0;

        foreach ($plan['rows'] as $row) {
            $person = $written[$row['line']] ?? null;

            if (! $person) {
                continue;
            }

            foreach ($row['rbim_tags'] ?? [] as [$type]) {
                if (! $person->sectors()->where('sector_type', $type)->exists()
                    && ! ($type === 'Solo Parent' && $person->spouse_id)) {
                    $tagsWanted++;
                }
            }

            if (! empty($row['values']['registered_voter_in']) && blank($person->registered_voter_in)) {
                $voterWanted++;
            }

            if (! empty($row['values']['nationality']) && blank($person->nationality)) {
                $nationalityWanted++;
            }
        }

        $this->line(sprintf(
            '%d line(s) matched to residents; %d not on the register; %d with more than one namesake (left alone).',
            count($written), $unmatched, $ambiguous
        ));
        $this->line("PWD / Solo Parent tags to add: {$tagsWanted}");
        $this->line("Registered-voter answers to fill in (blank on the record): {$voterWanted}");
        $this->line("Nationalities to fill in (blank on the record): {$nationalityWanted}");

        if ($this->option('dry-run')) {
            $this->info('Dry run — nothing was changed.');

            return self::SUCCESS;
        }

        $voterFilled = 0;
        $nationalityFilled = 0;

        $tagged = DB::transaction(function () use ($plan, $written, &$voterFilled, &$nationalityFilled) {
            foreach ($plan['rows'] as $row) {
                $person = $written[$row['line']] ?? null;
                $voter = $row['values']['registered_voter_in'] ?? null;

                if ($person && $voter && blank($person->registered_voter_in)) {
                    $person->forceFill(['registered_voter_in' => $voter])->save();
                    $voterFilled++;
                }

                $nationality = $row['values']['nationality'] ?? null;

                if ($person && $nationality && blank($person->nationality)) {
                    $person->forceFill(['nationality' => $nationality])->save();
                    $nationalityFilled++;
                }
            }

            return RegisterImport::tagFromCensus($plan['rows'], $written);
        });

        $this->info("Added {$tagged} tag(s); filled {$voterFilled} registered-voter answer(s) and {$nationalityFilled} nationality answer(s). Nothing else was changed.");

        return self::SUCCESS;
    }
}
