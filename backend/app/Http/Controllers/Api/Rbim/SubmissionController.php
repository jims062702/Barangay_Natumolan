<?php

namespace App\Http\Controllers\Api\Rbim;

use App\Http\Controllers\Api\BaseController;
use App\Models\Rbim\Census;
use App\Services\Rbim\CensusAccess;
use App\Services\Rbim\CensusRegistration;
use App\Services\Rbim\CensusSubmissionRefused;
use Illuminate\Http\JsonResponse;

/** Submitting a census form: the one door between the census and the register. */
class SubmissionController extends BaseController
{
    public function store(Census $rbimCensus, CensusAccess $access, CensusRegistration $registration): JsonResponse
    {
        if (!$access->canCollect()) {
            return $this->forbidden('Your office does not collect the RBIM census');
        }

        try {
            [$census, $message] = $registration->register($rbimCensus);
        } catch (CensusSubmissionRefused $refused) {
            return $this->error($refused->getMessage(), $refused->status, $refused->errors);
        }

        return $this->success($census, $message);
    }
}
