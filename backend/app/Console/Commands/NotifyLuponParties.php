<?php

namespace App\Console\Commands;

use App\Models\Account\Notification;
use App\Models\Lupon\CaseFile;
use App\Services\Lupon\PartyNotice;
use Illuminate\Console\Command;

/**
 * Tells the parties of every case already in their Lupon Records.
 *
 *   php artisan lupon:notify-parties --dry-run   (lists who would be told)
 *   php artisan lupon:notify-parties
 *
 * For cases whose summons was served before the portal started sending the
 * "now in your Lupon Records" notice. Safe to run again: a party who already
 * has it for a case is skipped.
 */
class NotifyLuponParties extends Command
{
    protected $signature = 'lupon:notify-parties {--dry-run : List who would be told, and tell nobody}';

    protected $description = "Send the 'now in your Lupon Records' notice to parties who never received it";

    public function handle(PartyNotice $notice): int
    {
        $sent = 0;

        foreach (CaseFile::summonsIssued()->orderBy('id')->get() as $case) {
            if ($this->option('dry-run')) {
                $told = Notification::where('notification_type', PartyNotice::TYPE_RECORD)
                    ->where('related_entity_type', 'lupon_case')
                    ->where('related_entity_id', $case->id)
                    ->pluck('resident_id')
                    ->map(fn ($id) => (int) $id)
                    ->all();
                $waiting = array_values(array_diff(array_map('intval', $case->partyResidentIds()), $told));
                $this->line("{$case->case_number}: " . ($waiting ? count($waiting) . ' party(ies) to tell' : 'everyone already told'));
                $sent += count($waiting);

                continue;
            }

            $count = $notice->recordOpened($case);
            $this->line("{$case->case_number}: " . ($count ? "{$count} party(ies) told" : 'everyone already told'));
            $sent += $count;
        }

        $this->info(($this->option('dry-run') ? 'Would notify ' : 'Notified ') . "{$sent} party(ies).");

        return self::SUCCESS;
    }
}
