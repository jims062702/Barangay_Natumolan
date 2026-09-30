<?php

namespace App\Services\Vawc;

use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Vawc\OnlineReport;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * "A new VAWC online complaint" — to the VAW Desk's own staff only, the
 * moment one arrives.
 *
 * THE LEAST THAT GETS IT OPENED. A notification sits in a bell, in a list,
 * on a screen somebody else may be looking at — so it carries the reference,
 * when it came, and where it stands. No name, no respondent, no word of what
 * happened: all of that is behind the VAW Desk's own login, where opening it
 * is logged.
 *
 * Sent once, from where the complaint is written (OnlineReports::file), so a
 * refresh of the queue can never send it again.
 */
final class OnlineReportNotice
{
    public const TYPE = 'vawc_online_complaint';

    public static function toDesk(OnlineReport $report): void
    {
        $staff = User::where('is_active', true)
            ->where('office', 'VAWC')
            ->where('role', '!=', 'Resident')
            ->pluck('id');

        if ($staff->isEmpty()) {
            return;
        }

        $received = Carbon::parse($report->created_at)->setTimezone(ManilaTime::ZONE)->format('M j, Y g:i A');

        Notification::notifyUsers(
            $staff,
            self::TYPE,
            'New VAWC online complaint: ' . $report->reference_no,
            'Received ' . $received . ' · Status: ' . $report->status . ' · Open it on the VAW Desk.',
            'vawc_online_report',
            $report->id,
            '/vawc/online-reports?ref=' . rawurlencode($report->reference_no)
        );
    }
}
