<?php

namespace App\Services\Resident;

use App\Models\Resident\ResidentCard;
use RuntimeException;

/** Refused: this resident already holds an Active Resident ID — the one carried here. */
final class CardAlreadyActive extends RuntimeException
{
    public function __construct(public readonly ResidentCard $card)
    {
        parent::__construct('This resident already has an active Resident ID.');
    }
}
