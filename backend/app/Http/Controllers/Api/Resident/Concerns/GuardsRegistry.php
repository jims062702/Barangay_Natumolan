<?php

namespace App\Http\Controllers\Api\Resident\Concerns;

/**
 * Who may change the resident registry.
 */
trait GuardsRegistry
{
    /**
     * Store a new resident
     */
    /** Only the Population Office (and Admin) may add or edit residents. */
    private function canWriteRegistry(): bool
    {
        $user = auth()->user();

        return $user->office === 'Population' || $user->role === 'Admin';
    }
}
