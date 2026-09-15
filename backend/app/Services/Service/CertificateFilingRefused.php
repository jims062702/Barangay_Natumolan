<?php

namespace App\Services\Service;

use RuntimeException;

/** Why a certificate could not be filed, with the status and details to answer with. */
final class CertificateFilingRefused extends RuntimeException
{
    public function __construct(string $message, public readonly int $status, public readonly ?array $errors = null)
    {
        parent::__construct($message);
    }
}
