<?php

namespace App\Http\Requests\Content;

use App\Models\Content\Announcement;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Every field any kind of post can carry.
 *
 * They are all optional at this level because which ones apply depends on
 * the kind, and a rule set that demanded a venue would block an
 * Announcement that has no venue to give. Only the title, body and kind are
 * required — when the post is created.
 */
abstract class AnnouncementRequest extends FormRequest
{
    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? 'required' : 'sometimes';

        return [
            'title' => "{$required}|string|max:80",
            'body' => "{$required}|string|max:1000",
            'category' => "{$required}|in:" . implode(',', array_keys(Announcement::KINDS)),
            'status' => 'nullable|in:' . implode(',', Announcement::STATUSES),

            'author_name' => 'nullable|string|max:120',
            'excerpt' => 'nullable|string|max:80',
            'image' => 'nullable|image|max:5120',

            /* Event */
            'event_at' => 'nullable|date',
            'event_time' => 'nullable|string|max:60',
            'organizer' => 'nullable|string|max:150',
            'contact_info' => 'nullable|string|max:150',
            'registration_deadline' => 'nullable|date',

            /* Activity */
            'completed_at' => 'nullable|date',
            'participants' => 'nullable|string|max:255',

            /* Advisory */
            'effective_at' => 'nullable|date',
            'expires_at' => 'nullable|date|after_or_equal:effective_at',
            'urgency' => 'nullable|in:' . implode(',', Announcement::URGENCIES),

            /* Event, Activity and Program all use a venue. */
            'location' => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'title.max' => 'The title must not exceed 80 characters.',
            'excerpt.max' => 'The short description must not exceed 80 characters.',
            'body.max' => 'The full details must not exceed 1,000 characters.',
        ];
    }
}
