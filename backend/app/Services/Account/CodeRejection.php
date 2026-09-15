<?php

namespace App\Services\Account;

/** Why a password code was refused, and the status to say it with. */
final class CodeRejection
{
    public function __construct(
        public readonly string $message,
        public readonly int $status,
    ) {
    }
}
