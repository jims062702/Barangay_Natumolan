<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Forgets offline jobs old enough that no device will ever resend them.
 *
 * Every piece of work an office sends from its queue leaves a row in
 * `offline_jobs`, so that a repeat of the same job can be recognised and not
 * applied twice. That protection only matters for as long as a device might
 * still retry — and without this, the table grows by every certificate and
 * registration the barangay ever files, for ever.
 *
 * Sixty days, well past anything this barangay's outages have run to. A
 * device offline longer than that has a stale register and an expired
 * sign-in anyway, and has to come back online before it can send anything.
 *
 * Rows still in progress (status 0) are left alone at any age: one of those
 * is a request that is running right now, and removing its claim would let
 * a retry run the same work a second time.
 */
class PurgeOfflineJobs extends Command
{
    protected $signature = 'offline-jobs:purge
                            {--days=60 : Forget completed jobs older than this}
                            {--dry-run : Count them without deleting}';

    protected $description = 'Forget recorded offline jobs too old to be resent';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $stale = DB::table('offline_jobs')
            ->where('created_at', '<', $cutoff)
            ->where('status_code', '>', 0);

        $count = (clone $stale)->count();

        if ($this->option('dry-run')) {
            $this->info("{$count} offline job(s) older than {$days} days would be forgotten.");

            return self::SUCCESS;
        }

        $stale->delete();

        $this->info("Forgot {$count} offline job(s) older than {$days} days.");

        return self::SUCCESS;
    }
}
