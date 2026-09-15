<?php

namespace App\Services\Rbim;

/** Which offices collect the census, and which one reconciles it into the register. */
final class CensusAccess
{
    /** Who may collect and encode: the BHW and the Population Office. */
    public function canCollect(): bool
    {
        $office = auth()->user()?->office;

        return in_array($office, ['Population', 'Health Station', 'Admin'], true);
    }

    /** Only the Population Office reconciles a census into the register. */
    public function canReconcile(): bool
    {
        return in_array(auth()->user()?->office, ['Population', 'Admin'], true);
    }
}
