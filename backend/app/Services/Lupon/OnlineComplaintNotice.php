<?php

namespace App\Services\Lupon;

use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Lupon\OnlineComplaint;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * "A new online complaint" — to the Lupon's own staff, the moment one
 * arrives (a resident's or a non-resident's, from the website or a portal).
 *
 * Sent once, from where the complaint is written (OnlineFiling), so a
 * refresh of the queue can never send it again. The bell opens the queue
 * searched to that reference.
 */
final class OnlineComplaintNotice
{
    public const TYPE = 'lupon_online_complaint';

    public static function toLupon(OnlineComplaint $complaint): void
    {
        $staff = User::where('is_active', true)
            ->where(function ($q) {
                $q->where('office', 'Lupon')
                  ->orWhere(function ($sub) {
                      $sub->where('office', 'Main Office')
                          ->whereIn('role', ['Secretary', 'Punong Barangay']);
                  });
            })
            ->where('role', '!=', 'Resident')
            ->pluck('id');

        if ($staff->isEmpty()) {
            return;
        }

        $sent = Carbon::parse($complaint->created_at)->setTimezone(ManilaTime::ZONE)->format('M j, Y g:i A');

        Notification::notifyUsers(
            $staff,
            self::TYPE,
            'New online complaint: ' . $complaint->reference_no,
            implode(' · ', array_filter([
                ($complaint->filer_kind === 'Resident' ? 'Resident' : 'Non-resident') . ': ' . $complaint->complainant_name,
                'Nature of the Case: ' . ($complaint->case_classification ?: 'not given'),
                'Sent ' . $sent,
                'Status: ' . $complaint->status,
            ])),
            'online_complaint',
            $complaint->id,
            '/lupon/online-complaints?q=' . rawurlencode($complaint->reference_no)
        );
    }
}
