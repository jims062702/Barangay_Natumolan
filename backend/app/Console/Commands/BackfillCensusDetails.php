<?php

namespace App\Console\Commands;

use App\Models\Rbim\Census;
use App\Models\Rbim\CensusMember;
use App\Models\Resident\Resident;
use Illuminate\Console\Command;

/**
 * Carries onto the register what already-submitted censuses answered.
 *
 * Until now, a census line matched to somebody already registered was
 * skipped at submit — the interview happened, the answers were stored on the
 * census, and the register was never told. Submitting again is not an option:
 * a census is submitted once.
 *
 * So this walks the censuses that are already in, finds the lines whose
 * resident is missing something the line knows, and fills it. Gaps only, the
 * same rule as the live path: a value somebody typed at the counter is never
 * overwritten by one from an interview.
 *
 *     php artisan census:backfill-details --dry-run
 *     php artisan census:backfill-details
 */
class BackfillCensusDetails extends Command
{
    protected $signature = 'census:backfill-details {--dry-run : List what would change and write nothing}';

    protected $description = 'Fill register gaps from already-submitted RBIM censuses';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $filledCount = 0;
        $peopleCount = 0;

        $censuses = Census::where('status', 'Submitted')->with('members')->get();

        $this->info($censuses->count() . ' submitted censuses to read.');

        foreach ($censuses as $census) {
            foreach ($census->members as $member) {
                if (! $member->resident_id) {
                    continue;
                }

                $resident = Resident::find($member->resident_id);

                if (! $resident) {
                    continue;
                }

                $changes = $this->gaps($member, $census, $resident);

                if ($changes === []) {
                    continue;
                }

                $peopleCount++;
                $filledCount += count($changes);

                $this->line(
                    '  ' . str_pad($resident->full_name, 24)
                    . collect($changes)
                        ->map(fn ($value, $field) => $field . ' = ' . $value)
                        ->implode(', ')
                );

                if (! $dry) {
                    $resident->update($changes);

                    if (array_key_exists('birthdate', $changes)) {
                        $resident->update(['birthdate_is_estimated' => true]);
                    }
                }
            }
        }

        if ($peopleCount === 0) {
            $this->info('Nothing to fill — every registered census line already matches.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->info(
            ($dry ? 'Would fill ' : 'Filled ')
            . $filledCount . ' fields across ' . $peopleCount . ' people.'
        );

        if ($dry) {
            $this->comment('Run again without --dry-run to write them.');
        }

        return self::SUCCESS;
    }

    /**
     * What this line knows and this resident's record does not.
     *
     * Kept deliberately narrow: the fields the census actually asks about and
     * the register has a column for. Q35 is the one this was written for —
     * how long they have lived here, which the Certificate of Residency
     * prints and nothing else in the system ever asks.
     */
    private function gaps(CensusMember $member, Census $census, Resident $resident): array
    {
        $marital = CensusMember::MARITAL_STATUSES[(int) $member->q8_marital_status] ?? null;

        $candidates = [
            'length_of_residence_years' => $member->q35_stay_years !== null
                ? (int) $member->q35_stay_years
                : null,
            'birth_place' => $member->q6_birthplace ?: null,
            'nationality' => \App\Support\Nationality::fromCode($member->q7_nationality, $member->q7_nationality_other),
            'civil_status' => in_array($marital, ['Single', 'Married', 'Widowed', 'Separated'], true)
                ? $marital
                : null,
            'contact_number' => $member->contact_number ?: null,
            'zone_purok' => $census->zone_purok ?: null,
            'household_id' => $census->household_id,
        ];

        $changes = [];

        foreach ($candidates as $field => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $current = $resident->getAttribute($field);

            if ($current !== null && $current !== '') {
                continue;
            }

            $changes[$field] = $value;
        }

        /* Held out of the loop: residents.email is unique, and writing one
           another record holds is a crash, not a gap being filled. */
        if (
            ! $resident->email
            && $member->email
            && ! Resident::where('email', $member->email)->whereKeyNot($resident->id)->exists()
        ) {
            $changes['email'] = $member->email;
        }

        return $changes;
    }
}
