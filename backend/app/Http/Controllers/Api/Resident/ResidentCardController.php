<?php

namespace App\Http\Controllers\Api\Resident;

use App\Http\Controllers\Api\BaseController;
use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Services\Resident\CardAlreadyActive;
use App\Services\Resident\ResidentCards;
use Illuminate\Http\Request;

/**
 * The Population Office issuing Barangay Resident IDs — from a resident's
 * record, from a census form, or from a household. Every one of those paths
 * comes here, so they all issue the same card under the same rules:
 *
 *   ISSUE      a first card, only for somebody who holds none. Somebody who
 *              already has an active card is refused (409) and shown it —
 *              never silently given a second.
 *   REISSUE    a new card in place of theirs: the old one is revoked at once,
 *              and kept in the history with who, when and why.
 *   IN BULK    cards for many at once — only those without one; the rest are
 *              skipped, and the answer says who and why.
 *
 * Who issued each card and when is kept on the card itself (issued_by,
 * issued_at, action, card_no), so the history IS the audit trail.
 */
class ResidentCardController extends BaseController
{
    /** The card they hold now, if any, and every card before it. */
    public function show(Resident $resident, ResidentCards $cards)
    {
        $card = $cards->current($resident);

        return $this->success([
            'eligible' => ResidentCards::eligible($resident),
            'card' => $card ? ResidentCards::cardData($card->load('resident')) : null,
            'issued_count' => ResidentCard::where('resident_id', $resident->id)->count(),
            'history' => $cards->history($resident),
        ], 'Resident ID');
    }

    /** Their first card — refused, with the card they hold, if they already have one. */
    public function issue(Resident $resident, ResidentCards $cards)
    {
        if (! ResidentCards::eligible($resident)) {
            return $this->error('Only an active resident of Barangay Natumolan can be issued a Resident ID.', 422);
        }

        try {
            $card = $cards->issue($resident, ResidentCard::VIA_OFFICE, auth()->user());
        } catch (CardAlreadyActive $e) {
            return response()->json([
                'success' => false,
                'message' => $resident->full_name . ' already has an active Resident ID (' . $e->card->card_no
                    . '). Download it, or issue a new card to replace it.',
                'data' => ResidentCards::cardData($e->card->load('resident')),
            ], 409);
        }

        return $this->success(ResidentCards::cardData($card->load('resident')), 'Resident ID issued to ' . $resident->full_name . '.', 201);
    }

    /** A new card in place of the one they hold. */
    public function reissue(Request $request, Resident $resident, ResidentCards $cards)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        if (! ResidentCards::eligible($resident)) {
            return $this->error('Only an active resident of Barangay Natumolan can be issued a Resident ID.', 422);
        }

        $replacing = $cards->current($resident);
        $card = $cards->reissue($resident, ResidentCard::VIA_OFFICE, auth()->user(), $data['reason'] ?? null);

        return $this->success(
            ResidentCards::cardData($card->load('resident')),
            $replacing
                ? 'A new Resident ID (' . $card->card_no . ') was issued. The previous card (' . $replacing->card_no . ') no longer verifies.'
                : 'Resident ID issued to ' . $resident->full_name . '.',
            201
        );
    }

    /** Where each of these residents stands — for a census form or a household. */
    public function standing(Request $request, ResidentCards $cards)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'max:200'],
            'ids.*' => ['integer'],
        ]);

        return $this->success($cards->standing($data['ids']), 'Resident ID standing');
    }

    /** Cards for many at once — only those who hold none. */
    public function bulk(Request $request, ResidentCards $cards)
    {
        $data = $request->validate([
            'resident_ids' => ['required', 'array', 'min:1', 'max:200'],
            'resident_ids.*' => ['integer'],
        ]);

        $result = $cards->issueMany($data['resident_ids'], ResidentCard::VIA_OFFICE, auth()->user());
        $n = count($result['issued']);
        $skipped = count($result['skipped']);

        return $this->success(
            $result,
            ($n === 1 ? '1 Resident ID issued.' : "{$n} Resident IDs issued.")
                . ($skipped ? " {$skipped} skipped (already holding an active ID, or not eligible)." : '')
        );
    }
}
