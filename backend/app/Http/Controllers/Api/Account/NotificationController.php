<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Api\BaseController;
use App\Models\Account\Notification;

/**
 * In-system notices for the current account — residents see notices
 * addressed to their linked resident record; staff see notices addressed
 * to their user id.
 */
class NotificationController extends BaseController
{
    public function index()
    {
        return $this->success([
            'unread_count' => (clone $this->scoped())->where('is_read', false)->count(),
            'notifications' => $this->scoped()->latest()->paginate(20),
        ], 'Notifications retrieved');
    }

    public function markRead(Notification $notification)
    {
        $user = auth()->user();
        $owned = $user->isResident()
            ? $notification->resident_id === $user->resident_id
            : $notification->user_id === $user->id;

        if (!$owned) {
            return $this->forbidden('Not your notification');
        }

        $notification->update(['is_read' => true, 'read_at' => now()]);

        return $this->success($notification, 'Marked as read');
    }

    public function markAllRead()
    {
        $this->scoped()->where('is_read', false)->update(['is_read' => true, 'read_at' => now()]);

        return $this->success(null, 'All notifications marked as read');
    }

    private function scoped()
    {
        $user = auth()->user();

        if ($user->isResident()) {
            return Notification::where('resident_id', $user->resident_id);
        }

        $query = Notification::where('user_id', $user->id);

        if ($user->role === 'Secretary') {
            // Secretary must not receive any certificate or clerk-related notifications
            $query->whereNotIn('notification_type', [
                'new_request',
                'certificate_request',
                'certificate_ready',
                'certificate_approved',
                'certificate_rejected',
                'chat_waiting',
            ])->where(function ($q) {
                $q->whereNull('link')
                  ->orWhere('link', 'not like', '%/certificates%');
            });
        }

        return $query;
    }
}
