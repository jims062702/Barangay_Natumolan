<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Public\ContactRequest;
use App\Models\Account\Notification;
use App\Models\Account\User;

class ContactController extends BaseController
{
    /**
     * Public "Contact Us" form. The message is delivered in-system to every
     * active Main Office staff member (and Admins) via the notification bell.
     */
    public function store(ContactRequest $request)
    {
        $validated = $request->validated();

        $recipients = User::where('is_active', true)
            ->where(function ($query) {
                $query->where('office', 'Main Office')->orWhere('role', 'Admin');
            })
            ->pluck('id');

        $body = $validated['message']
            . "\n\nFrom: " . $validated['full_name'] . ' · ' . $validated['email']
            . (!empty($validated['phone']) ? ' · ' . $validated['phone'] : '');

        foreach ($recipients as $userId) {
            Notification::create([
                'user_id' => $userId,
                'notification_type' => 'website_inquiry',
                'subject' => 'Website inquiry: ' . $validated['subject'],
                'message' => $body,
                'channel' => 'In-System',
                'is_sent' => true,
                'sent_at' => now(),
            ]);
        }

        return $this->success(null, 'Message received — the barangay office will get back to you.');
    }
}
