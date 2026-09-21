<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Portal\UpdateOwnDetailsRequest;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;

/** The resident's own record, and the few fields on it they may change. */
class ProfileController extends PortalController
{
    public function show()
    {
        $user = auth()->user()->load(['resident.household']);

        return $this->success(
            /*
             * The lists travel with the profile rather than from a second
             * call: the page cannot render the editable fields without them,
             * and two requests for one screen is two chances for it to
             * arrive half-drawn.
             */
            [
                'user' => $user,
                'occupations' => Resident::OCCUPATIONS,
                'civil_statuses' => Resident::CIVIL_STATUSES,
            ],
            'Profile retrieved'
        );
    }

    /**
     * The resident corrects what is theirs to correct.
     *
     * Three fields, and no more: what they do, whether they are married, and
     * the number the office rings. Each is a fact only the person holds, each
     * changes without any paperwork passing through the barangay, and the
     * office would otherwise learn it only by asking — which it does not do.
     * A stale contact number is the worst of the three, because it fails
     * silently: the certificate is ready and nobody answers.
     *
     * Occupation and civil status come from fixed lists, because the barangay
     * COUNTS these: "Carpenter", "carpenter" and "Karpentero" typed into an
     * open box are three occupations to a report and one job to everybody
     * else. A contact number is free text, since a number is a number.
     *
     * Everything else on the register still changes at the Population Office,
     * where there is a document to check it against.
     */
    public function updateDetails(Request $request)
    {
        $resident = auth()->user()?->resident;

        if (! $resident) {
            return $this->error('This account is not linked to a resident record.', 404);
        }

        /* Checked after the link above, so an unlinked account is told that
           rather than that its occupation is invalid. */
        $validated = $request->validate(
            UpdateOwnDetailsRequest::fields(),
            UpdateOwnDetailsRequest::fieldMessages()
        );

        if ($validated === []) {
            return $this->error('Nothing was sent to change.', 422);
        }

        /* Only what was sent. A field left out of the request is left alone
           on the record rather than blanked by an absent key — the page
           saves one row at a time. */
        $resident->forceFill($validated)->save();

        return $this->success(
            $resident->only(['occupation', 'civil_status', 'contact_number']),
            'Your details have been updated.'
        );
    }
}
