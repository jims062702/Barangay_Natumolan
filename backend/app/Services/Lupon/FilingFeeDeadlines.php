<?php

namespace App\Services\Lupon;

use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Payment;
use App\Support\ChangeLog;
use App\Support\ManilaTime;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * THE FILING FEE'S THREE CALENDAR DAYS (the office's rule, 2026-09-28).
 *
 * A case is filed, and the filing fee is required from that moment. The
 * complainant has until the END of the third calendar day after it, in
 * Manila — filed on a Monday, paid by Thursday midnight. Paid in time, the
 * case goes on as it always has. Not paid, the case is closed as
 * "Closed — Unpaid": not deleted, its complaint and history kept, and the
 * reason written on it and in its events.
 *
 * THE FEE AND THE CASE ARE TWO THINGS. payment_status (Unpaid, Paid,
 * Overdue) is the fee's; current_stage is the case's. The one transition
 * that joins them is this rule's: an Overdue fee closes a case still waiting
 * on it. Nothing else here moves a stage.
 *
 * No scheduler runs on the barangay's machine, so the sweep runs from the
 * API's own traffic (CloseUnpaidLuponCases), at most once a minute — the
 * first request after a deadline passes closes the case.
 */
final class FilingFeeDeadlines
{
    public const DAYS = 3;

    public const UNPAID = 'Unpaid';

    public const PAID = 'Paid';

    public const OVERDUE = 'Overdue';

    /** The end of the third calendar day after it was required, in Manila — as UTC. */
    public static function dueFrom(CarbonInterface $requiredAt): Carbon
    {
        return Carbon::instance($requiredAt)->setTimezone(ManilaTime::ZONE)
            ->startOfDay()->addDays(self::DAYS)->endOfDay()->utc();
    }

    /** "Oct 1, 2026" — the day it is due by, as the office says it. */
    public static function dueWords(?CarbonInterface $due): string
    {
        return $due ? Carbon::instance($due)->setTimezone(ManilaTime::ZONE)->format('M j, Y') : '';
    }

    /**
     * One line on the case's own trail — by whoever is signed in, or by the
     * system (no user) for what the rule itself did, whatever request
     * happened to be passing when it ran.
     */
    public static function record(CaseFile $case, string $event, ?string $detail = null, bool $bySystem = false): void
    {
        DB::table('lupon_case_events')->insert([
            'lupon_case_id' => $case->id,
            'event' => $event,
            'detail' => $detail,
            'user_id' => $bySystem ? null : auth()->id(),
            'created_at' => now(),
        ]);
    }

    /** Every case whose three days ran out unpaid, closed. Returns how many. */
    public static function closeOverdue(): int
    {
        $ids = CaseFile::where('current_stage', 'Filed')
            ->where('payment_status', self::UNPAID)
            ->whereNotNull('payment_due_at')
            ->where('payment_due_at', '<', now())
            ->pluck('id');

        $closed = 0;
        foreach ($ids as $id) {
            $closed += DB::transaction(function () use ($id) {
                $case = CaseFile::whereKey($id)->lockForUpdate()->first();
                if (! $case || $case->current_stage !== 'Filed' || $case->payment_status !== self::UNPAID) {
                    return 0;
                }

                /* Paid after all, and only the status lagged: it is Paid. */
                if ($case->payments()->where('kind', Payment::KIND_FILING)->where('status', 'Paid')->exists()) {
                    $case->update(['payment_status' => self::PAID]);

                    return 0;
                }

                $reason = 'Closed — Unpaid: the filing fee was not paid within ' . self::DAYS
                    . ' calendar days (due ' . self::dueWords($case->payment_due_at) . ', end of day).';

                $case->update([
                    'current_stage' => CaseFile::CLOSED_UNPAID,
                    'payment_status' => self::OVERDUE,
                    'auto_closed_at' => now(),
                    'date_resolved' => ManilaTime::today(),
                    'closure_reason' => $reason,
                ]);
                self::record($case, 'closed_unpaid', $reason, bySystem: true);

                return 1;
            });
        }

        if ($closed > 0) {
            ChangeLog::bump('lupon_cases');
        }

        return $closed;
    }

    /** At most once a minute — see CloseUnpaidLuponCases. */
    public static function sweep(): void
    {
        if (Cache::add('lupon:filing-fee-sweep', true, 60)) {
            self::closeOverdue();
        }
    }
}
