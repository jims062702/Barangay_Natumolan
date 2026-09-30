<?php

namespace App\Services\Lupon;

use App\Models\Account\Notification;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Models\Lupon\Settlement;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * Tells each party when something new is in their Lupon Records.
 *
 *   the case reaches their portal     once per party, when the summons is printed
 *   the case changes stage            conciliation, settled, dismissed
 *   the settlement changes status     final, repudiated, complied, …
 *
 * (A hearing being set or moved is HearingNotice's.)
 *
 * NOTHING BEFORE THE SUMMONS IS PRINTED. Until then the case is not on their
 * portal (CaseFile::summonsIssued): a respondent does not learn of a
 * complaint from a phone before the summons reaches their door.
 *
 * NEVER "REFERRED". A case referred on may have gone to the VAW Desk, and a
 * line on a portal saying so is exactly what RA 9262 keeps confidential.
 * Only the stages named below are ever announced.
 *
 * Each notice opens the reader's own side of the page — Cases I Filed, or
 * Cases Against Me — so the complainant and the respondent are each taken to
 * the view that is theirs.
 */
final class PartyNotice
{
    public const TYPE_RECORD = 'lupon_record';

    public const TYPE_UPDATE = 'lupon_update';

    private const FILED = '/resident/lupon/filed';

    private const AGAINST_ME = '/resident/lupon/against-me';

    /**
     * "This case is now in your Lupon Records" — to every party not yet told.
     *
     * Safe to call again: a party who already has this notice for this case
     * is skipped, so printing the summons twice, recording service after it,
     * or running the catch-up for older cases never tells anybody twice.
     */
    public function recordOpened(CaseFile $case, ?Hearing $summonedTo = null): int
    {
        if (! $case->summonsWasIssued()) {
            return 0;
        }

        $already = Notification::where('notification_type', self::TYPE_RECORD)
            ->where('related_entity_type', 'lupon_case')
            ->where('related_entity_id', $case->id)
            ->pluck('resident_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        /*
         * The sitting to name: the one the summons calls them to, when this
         * is the summons itself — otherwise (the catch-up for older cases)
         * the NEXT one still ahead, because the sitting the summons named may
         * be weeks past. None ahead, no date: better than a date gone by.
         *
         * Hearing times are Manila wall-clock, so they are compared with
         * Manila's now and printed as stored, never converted.
         */
        $hearing = $summonedTo ?? $case->hearings()
            ->where('status', 'Scheduled')
            ->where('scheduled_at', '>', ManilaTime::now())
            ->orderBy('scheduled_at')
            ->first();
        $when = $hearing?->scheduled_at?->format('F j, Y g:i A');

        $sent = 0;
        foreach ($case->partyResidentIds() as $residentId) {
            if (in_array((int) $residentId, $already, true)) {
                continue;
            }

            $complainant = (int) $residentId === (int) $case->complainant_id;

            /* With the summons itself the date is the one on the paper; in
               the catch-up it is only the next sitting, and says so. */
            $sitting = ! $when ? '.'
                : ($summonedTo
                    ? ($complainant ? "; the hearing is on {$when} at the Barangay Hall." : " to appear on {$when} at the Barangay Hall.")
                    : ". The next hearing is on {$when} at the Barangay Hall.");

            $message = $complainant
                ? "Your complaint is now in your Lupon Records as case {$case->case_number}. "
                    . 'A summons has been issued to the respondent' . $sitting
                : "A complaint naming you is now in your Lupon Records as case {$case->case_number}. "
                    . 'A summons has been issued' . $sitting;

            Notification::notifyResident(
                $residentId,
                self::TYPE_RECORD,
                'Lupon Records — ' . $case->case_number,
                $message,
                'lupon_case',
                $case->id,
                $complainant ? self::FILED : self::AGAINST_ME
            );
            $sent++;
        }

        return $sent;
    }

    /** The case moved to a stage a party needs to know about. */
    public function stageChanged(CaseFile $case): void
    {
        if (! $case->summonsWasIssued()) {
            return;
        }

        $on = $case->date_resolved
            ? Carbon::parse($case->date_resolved)->format('F j, Y')
            : Carbon::parse(ManilaTime::today())->format('F j, Y');

        $message = match ($case->current_stage) {
            'Conciliation' => $this->toConciliation($case),
            'Settled' => $this->settled($case, $on),
            'Dismissed' => "Case {$case->case_number} was dismissed on {$on}.",
            'Withdrawn' => "Case {$case->case_number} was withdrawn on {$on} and is closed at the Lupon.",
            /* The complainant may now take it to court, which is the whole
               point of the certificate — so they are told it exists. */
            'CFA' => "Case {$case->case_number} was certified to file action on {$on}. "
                . 'The Certificate to File Action may be claimed at the Lupon office.',
            /* Filed, Mediation and — above all — Referred say nothing. */
            default => null,
        };

        if ($message !== null) {
            $this->toParties($case, $message);
        }
    }

    /** The settlement moved on: final, repudiated, complied, … */
    public function settlementChanged(Settlement $settlement): void
    {
        $case = $settlement->luponCase;

        if (! $case || ! $case->summonsWasIssued()) {
            return;
        }

        $n = $case->case_number;

        $message = match ($settlement->status) {
            'Final' => "The settlement on case {$n} is now final.",
            'Repudiated' => "The settlement on case {$n} was repudiated. The case goes back to conciliation before the Lupon.",
            'Complied' => "The settlement on case {$n} was recorded as complied with.",
            'Not Complied' => "The settlement on case {$n} was recorded as not complied with.",
            'Executed' => "Execution of the settlement on case {$n} was recorded.",
            default => null,
        };

        if ($message !== null) {
            $this->toParties($case, $message);
        }
    }

    private function toConciliation(CaseFile $case): ?string
    {
        /*
         * A repudiated settlement also sends the case back to conciliation —
         * and settlementChanged() has already said so, in the same breath.
         */
        if ($case->settlement()->value('status') === 'Repudiated') {
            return null;
        }

        /* Wall-clock Manila in the column, so compared with Manila's now. */
        $first = $case->hearings()
            ->where('hearing_type', 'Conciliation')
            ->where('status', 'Scheduled')
            ->where('scheduled_at', '>', ManilaTime::now())
            ->orderBy('scheduled_at')
            ->first();

        return "Mediation on case {$case->case_number} ended without an agreement, so the case goes to "
            . 'conciliation before the Lupon.'
            . ($first ? ' The first sitting is on ' . $first->scheduled_at->format('F j, Y g:i A') . ' at the Barangay Hall.' : '');
    }

    private function settled(CaseFile $case, string $on): string
    {
        /* Read fresh: the relation may have been loaded before the row existed. */
        $deadline = $case->settlement()->value('repudiation_deadline');

        return "Case {$case->case_number} was settled on {$on}."
            . ($deadline ? ' The settlement becomes final after ' . Carbon::parse($deadline)->format('F j, Y') . ' unless it is repudiated.' : '');
    }

    private function toParties(CaseFile $case, string $message): void
    {
        foreach ($case->partyResidentIds() as $residentId) {
            Notification::notifyResident(
                $residentId,
                self::TYPE_UPDATE,
                'Lupon Records — ' . $case->case_number,
                $message,
                'lupon_case',
                $case->id,
                (int) $residentId === (int) $case->complainant_id ? self::FILED : self::AGAINST_ME
            );
        }
    }
}
