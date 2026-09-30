<?php

namespace App\Services\Content;

use App\Models\Account\Notification;
use App\Models\Account\User;
use App\Models\Content\Announcement;
use Illuminate\Support\Str;

/**
 * A published post reaches every resident's bell.
 *
 * ONCE, when it first goes out — the moment published_at is stamped. A
 * correction to the title two weeks later is not news, and a post taken down
 * and put back up is the same post; neither rings every phone again.
 *
 * To residents with a portal account only. A notice is read in the portal,
 * so a row for somebody with no account is a row nobody will ever open.
 */
final class AnnouncementNotice
{
    public const TYPE = 'announcement';

    public function toResidents(Announcement $post): int
    {
        if ($post->status !== 'Published') {
            return 0;
        }

        $residentIds = User::where('role', 'Resident')
            ->where('is_active', true)
            ->whereNotNull('resident_id')
            ->pluck('resident_id');

        return Notification::notifyResidents(
            $residentIds,
            self::TYPE,
            Str::limit(($post->category ?: 'Announcement') . ': ' . $post->title, 250),
            $this->summary($post),
            'announcement',
            $post->id,
            '/news/' . $post->id
        );
    }

    /** A post taken down takes its notices with it: they would open nothing. */
    public function withdraw(Announcement $post): void
    {
        Notification::where('notification_type', self::TYPE)
            ->where('related_entity_type', 'announcement')
            ->where('related_entity_id', $post->id)
            ->delete();
    }

    /** The line under the title: when and where for an event, else the gist. */
    private function summary(Announcement $post): string
    {
        $gist = trim(preg_replace('/\s+/', ' ', html_entity_decode(strip_tags((string) ($post->excerpt ?: $post->body)))));

        $lead = match ($post->category) {
            'Event' => $post->event_at
                ? 'On ' . $post->event_at->format('F j, Y') . ($post->event_time ? ', ' . $post->event_time : '')
                    . ($post->location ? ' at ' . $post->location : '') . '. '
                : '',
            'Advisory' => in_array($post->urgency, ['High', 'Critical'], true) ? 'Urgent. ' : '',
            default => '',
        };

        return Str::limit($lead . $gist, 200);
    }
}
