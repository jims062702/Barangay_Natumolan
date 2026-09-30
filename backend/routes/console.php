<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Age is not a fact anybody types in — it is a fact about today.
 *
 * A resident's age comes from their birthdate every time it is read, so it is
 * always right on screen. Their SECTOR does not: Child, Youth, Adult and
 * Senior Citizen are rows in `resident_sectors`, written when the record was
 * created, and nothing moves them afterwards. Without this, a child who turns
 * fifteen stays on the children's list until somebody notices — which is how
 * a barangay ends up planning a feeding programme around a list of people who
 * grew up.
 *
 * Every night, then. The command is idempotent and only writes what changed,
 * so a night with no birthdays costs one pass and no writes.
 *
 * This needs the scheduler running: one cron entry on the server,
 *   * * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
 * or, on this XAMPP machine, a Task Scheduler job doing the same. Without it
 * the sectors still correct themselves the next time anybody runs
 * `php artisan residents:sync-sectors` by hand.
 */
Schedule::command('residents:sync-sectors')
    ->dailyAt('00:30')
    ->withoutOverlapping()
    ->onOneServer();

/*
 * The three-hour idle rule the barangay set.
 *
 * The command existed and nothing ran it, so the rule was written down and
 * never enforced: a signed-in office stayed signed in for ever, idle or not.
 *
 * Hourly is enough. The rule is "idle for more than three hours", so a
 * token is cleared somewhere between three and four hours of silence —
 * close enough for a rule about walking away from a desk, and a sixtieth of
 * the work of running every minute.
 *
 * It does not reach an office working with no line. A device that is offline
 * sends nothing, so nothing it holds is refused; it stays signed in for as
 * long as the line is down, which is what the barangay asked for. Only when
 * the line returns does a long-idle token have to be signed in again — and
 * the work queued in the meantime is kept on the device throughout.
 */
Schedule::command('tokens:purge-idle', ['--hours' => 3])
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();

/*
 * A live conversation the resident stopped answering closes a day after the
 * Clerk's last reply (IdleConversations). The desk and the widget apply the
 * same rule whenever they load; this is for the hours nobody has either open.
 */
Schedule::command('chat:close-idle')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer();

/* The record of work sent from offline devices, kept only as long as a
   device could still resend it. See PurgeOfflineJobs. */
Schedule::command('offline-jobs:purge')
    ->dailyAt('01:00')
    ->withoutOverlapping()
    ->onOneServer();
