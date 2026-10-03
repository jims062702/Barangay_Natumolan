<?php

namespace App\Http\Controllers\Api\Portal;

use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Services\Resident\ResidentCards;
use Illuminate\Http\Request;

/**
 * The resident's own Barangay Resident ID, on My Profile.
 *
 * Drawn from the register as it stands; nothing on it is edited here. Their
 * first visit issues it — a portal account is already a verified resident,
 * so there is nothing more to check — and after that the same card is shown
 * until the Population Office prints them a new one.
 */
class ResidentCardController extends PortalController
{
    public function show(ResidentCards $cards)
    {
        $resident = Resident::find($this->residentId());

        if (! $resident) {
            return $this->notFound('No resident record is linked to your account');
        }

        if (! ResidentCards::eligible($resident)) {
            return $this->error('A Barangay Resident ID is issued only to active residents of Barangay Natumolan. '
                . 'Please visit the Population Office.', 422);
        }

        $card = $cards->current($resident);

        if (! $card) {
            return $this->success(null, 'No Barangay Resident ID has been issued yet.');
        }

        return $this->success(ResidentCards::cardData($card->load('resident')), 'Your Barangay Resident ID');
    }

    /**
     * An uploaded ID, checked on the portal: valid, AND theirs. A resident
     * signed in to their own account files with their own card, not a
     * neighbour's.
     */
    public function check(Request $request, ResidentCards $cards)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:300'],
            /* "complaint" or "vawc" — see ResidentCards::formSummary(). */
            'purpose' => ['nullable', 'in:complaint,vawc'],
        ]);
        $check = $cards->verify($data['code']);

        if ($check['ok'] && $check['resident']->id !== (int) $this->residentId()) {
            $check = [
                'ok' => false, 'reason' => 'not_yours', 'card' => $check['card'], 'resident' => null,
                'message' => 'This Resident ID belongs to another resident. Upload your own — you can download it from My Profile.',
            ];
        }

        return $this->success(ResidentCards::formSummary($check, $data['purpose'] ?? null), 'Resident ID check');
    }
}
