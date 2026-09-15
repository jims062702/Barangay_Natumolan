<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Portal\UpdateOccupationRequest;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;

/** The resident's own record, and the one field on it they may change. */
class ProfileController extends PortalController
{
    public function show()
    {
        $user = auth()->user()->load(['resident.household']);

        return $this->success(
            /*
             * The list travels with the profile rather than from a second
             * call: the page cannot render the one editable field without
             * it, and two requests for one screen is two chances for it to
             * arrive half-drawn.
             */
            ['user' => $user, 'occupations' => Resident::OCCUPATIONS],
            'Profile retrieved'
        );
    }

    /**
     * The resident says what work they do.
     *
     * The only field in the registry a resident may change about themselves.
     * From a fixed list, because the barangay counts these: "Carpenter",
     * "carpenter" and "Karpentero" typed into an open box are three
     * occupations to a report and one job to everybody else.
     */
    public function updateOccupation(Request $request)
    {
        $resident = auth()->user()?->resident;

        if (! $resident) {
            return $this->error('This account is not linked to a resident record.', 404);
        }

        /* Checked after the link above, so an unlinked account is told that
           rather than that its occupation is invalid. */
        $validated = $request->validate(UpdateOccupationRequest::fields(), UpdateOccupationRequest::fieldMessages());

        $resident->forceFill(['occupation' => $validated['occupation']])->save();

        return $this->success(
            ['occupation' => $resident->occupation],
            'Your occupation has been updated.'
        );
    }
}
