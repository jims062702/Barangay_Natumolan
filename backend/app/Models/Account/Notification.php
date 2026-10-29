<?php

namespace App\Models\Account;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Resident\Resident;

class Notification extends Model
{
    protected $fillable = [
        'resident_id',
        'user_id',
        'notification_type',
        'subject',
        'message',
        'channel',
        'is_sent',
        'sent_at',
        'is_read',
        'read_at',
        'related_entity_type',
        'related_entity_id',
        /* The page the notice is about — the bell opens it. */
        'link',
    ];

    protected function casts(): array
    {
        return [
            'is_sent' => 'boolean',
            'is_read' => 'boolean',
            'sent_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Helper used across controllers to notify a resident in-system. */
    public static function notifyResident(?int $residentId, string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): ?self
    {
        if (!$residentId) {
            return null;
        }

        return self::create([
            'resident_id' => $residentId,
            'notification_type' => $type,
            'subject' => $subject,
            'message' => $message,
            'channel' => 'In-System',
            'is_sent' => true,
            'sent_at' => now(),
            'related_entity_type' => $entityType,
            'related_entity_id' => $entityId,
            'link' => $link,
        ]);
    }

    /**
     * The same notice to many residents at once — an announcement to every
     * portal account.
     *
     * Inserted in chunks rather than one row at a time: a post that reaches
     * a thousand accounts should cost a handful of statements, not a
     * thousand, while the SK officer waits for "Post published".
     *
     * @param iterable<int> $residentIds
     */
    public static function notifyResidents(iterable $residentIds, string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): int
    {
        $now = now();
        $rows = collect($residentIds)->filter()->unique()->values()->map(fn ($residentId) => [
            'resident_id' => $residentId,
            'notification_type' => $type,
            'subject' => $subject,
            'message' => $message,
            'channel' => 'In-System',
            'is_sent' => true,
            'sent_at' => $now,
            'is_read' => false,
            'related_entity_type' => $entityType,
            'related_entity_id' => $entityId,
            'link' => $link,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($rows->chunk(500) as $chunk) {
            self::insert($chunk->all());
        }

        return $rows->count();
    }

    /** Notify a set of staff users in-system (one row each). */
    public static function notifyUsers(iterable $userIds, string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): void
    {
        foreach ($userIds as $userId) {
            self::create([
                'user_id' => $userId,
                'notification_type' => $type,
                'subject' => $subject,
                'message' => $message,
                'channel' => 'In-System',
                'is_sent' => true,
                'sent_at' => now(),
                'related_entity_type' => $entityType,
                'related_entity_id' => $entityId,
                'link' => $link,
            ]);
        }
    }

    /** Notify every active Punong Barangay (certificate decisions, etc.). */
    public static function notifyPunongBarangay(string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): void
    {
        $ids = User::where('is_active', true)->where('role', 'Punong Barangay')->pluck('id');
        self::notifyUsers($ids, $type, $subject, $message, $entityType, $entityId, $link);
    }

    /** Notify the Main Office front desk (clerks/secretary — not the PB). */
    public static function notifyFrontDesk(string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): void
    {
        $ids = User::where('is_active', true)
            ->where('office', 'Main Office')
            ->where('role', '!=', 'Punong Barangay')
            ->pluck('id');
        self::notifyUsers($ids, $type, $subject, $message, $entityType, $entityId, $link);
    }

    /**
     * Notify the Population Office — the one desk that may add somebody to
     * the register, told when another desk served somebody who is not on it.
     */
    public static function notifyPopulation(string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): void
    {
        $ids = User::where('is_active', true)
            ->where('office', 'Population')
            ->pluck('id');
        self::notifyUsers($ids, $type, $subject, $message, $entityType, $entityId, $link);
    }

    /**
     * Notify the Lupon office.
     *
     * For the half of a two-office job the OTHER office finishes. The Lupon
     * asks the Clerk for a filing fee and then cannot proceed until it is
     * settled — and had no way to learn that it had been, short of reopening
     * the case and looking. An officer who has to keep checking is an officer
     * who checks late.
     */
    public static function notifyLupon(string $type, string $subject, string $message, ?string $entityType = null, ?int $entityId = null, ?string $link = null): void
    {
        $ids = User::where('is_active', true)
            ->where('office', 'Lupon')
            ->pluck('id');
        self::notifyUsers($ids, $type, $subject, $message, $entityType, $entityId, $link);
    }
}
