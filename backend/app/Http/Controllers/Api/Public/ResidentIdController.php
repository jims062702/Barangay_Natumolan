<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Api\BaseController;
use App\Services\Resident\ResidentCards;
use Illuminate\Http\Request;

/**
 * Checking a Barangay Resident ID — by its QR, or the code printed under it.
 *
 * Open to anybody, because a card is checked by whoever it is shown to. What
 * comes back is whether it is valid and whose it is in part ("JU** DE**
 * CR**", the resident number) — never an address or a birthday. See
 * ResidentCards::summary(). A complaint form that says so gets the contact
 * number the card carries as well, to fill in its box — see formSummary().
 */
class ResidentIdController extends BaseController
{
    /** The page a scanned QR opens. */
    public function show(string $code, ResidentCards $cards)
    {
        return $this->success(ResidentCards::summary($cards->verify($code)), 'Resident ID check');
    }

    /**
     * The same check, for a form that has just read a QR from an uploaded
     * picture — and says what it is for: "complaint" (the Lupon's) or "vawc".
     */
    public function verify(Request $request, ResidentCards $cards)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:300'],
            'purpose' => ['nullable', 'in:complaint,vawc'],
        ]);

        return $this->success(
            ResidentCards::formSummary($cards->verify($data['code']), $data['purpose'] ?? null),
            'Resident ID check'
        );
    }
}
