<?php

namespace App\Services\Council;

use App\Models\Council\Official;

/**
 * Which positions exist in each group, how many may hold each, and the order
 * they are listed in — the rules the officials roster is kept to.
 */
final class OfficialPositions
{
    /** Allowed positions per group. */
    private const POSITIONS = [
        'Barangay' => ['Punong Barangay', 'Barangay Kagawad', 'Barangay Secretary', 'Barangay Treasurer'],
        'SK' => ['SK Chairperson', 'SK Kagawad', 'SK Secretary', 'SK Treasurer'],
    ];

    /** Maximum number of holders allowed per position. */
    private const LIMITS = [
        'Punong Barangay' => 1,
        'Barangay Kagawad' => 7,
        'Barangay Secretary' => 1,
        'Barangay Treasurer' => 1,
        'SK Chairperson' => 1,
        'SK Kagawad' => 7,
        'SK Secretary' => 1,
        'SK Treasurer' => 1,
    ];

    public function belongsTo(string $group, string $position): bool
    {
        return in_array($position, self::POSITIONS[$group], true);
    }

    /** Sort weight used to place the head first, then kagawads, sec, treasurer. */
    public function priority(string $position): int
    {
        return match ($position) {
            'Punong Barangay', 'SK Chairperson' => 1,
            'Barangay Kagawad', 'SK Kagawad' => 2,
            'Barangay Secretary', 'SK Secretary' => 3,
            'Barangay Treasurer', 'SK Treasurer' => 4,
            default => 5,
        };
    }

    /**
     * Returns an error message if a position has reached its holder limit,
     * otherwise null.
     */
    public function limitError(string $group, string $position, ?int $ignoreId = null): ?string
    {
        $max = self::LIMITS[$position] ?? null;
        if ($max === null) {
            return null;
        }

        $count = Official::where('group', $group)
            ->where('position', $position)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->count();

        if ($count < $max) {
            return null;
        }

        return $max === 1
            ? "There is already a {$position}. Remove the current one first, or edit that record instead."
            : "The maximum of {$max} {$position} has been reached. Remove one first to add another.";
    }
}
