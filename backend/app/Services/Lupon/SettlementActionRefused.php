<?php

namespace App\Services\Lupon;

use RuntimeException;

/** A compliance action the settlement's state does not allow. */
final class SettlementActionRefused extends RuntimeException
{
}
