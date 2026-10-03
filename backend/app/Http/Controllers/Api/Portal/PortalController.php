<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Controllers\Api\BaseController;

/**
 * Resident portal — every endpoint is scoped to the authenticated
 * portal account's linked resident record (accounts are created by the BPO).
 */
abstract class PortalController extends BaseController
{
    /** The register entry the signed-in portal account belongs to. */
    protected function residentId()
    {
        return auth()->user()->resident_id;
    }

    /** The resident record for the signed-in portal account. */
    protected function resident()
    {
        return auth()->user()->resident;
    }
}
