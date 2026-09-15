<?php

namespace App\Services\Rbim;

use RuntimeException;

/** Why a census form could not be registered, with the status and details to answer with. */
final class CensusSubmissionRefused extends RuntimeException
{
    public function __construct(string $message, public readonly int $status, public readonly ?array $errors = null)
    {
        parent::__construct($message);
    }
}
