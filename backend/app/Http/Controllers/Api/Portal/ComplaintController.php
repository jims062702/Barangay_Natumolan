<?php

namespace App\Http\Controllers\Api\Portal;

use App\Http\Requests\Lupon\FileComplaintFromPortalRequest;
use App\Http\Requests\Lupon\FileOnlineComplaintRequest;
use App\Models\Lupon\OnlineComplaint;
use App\Models\Resident\Resident;
use App\Services\Lupon\JurisdictionScreen;
use App\Services\Lupon\OnlineFiling;
use App\Services\Resident\ResidentCards;

/**
 * A resident beginning a KP complaint from their own portal.
 *
 * The public form and this one end in the same place — a reference number,
 * "For Office Verification", and no case — but they start from different
 * places, and the difference is worth its own controller:
 *
 *   the PUBLIC form   knows nobody. A resident there is identified by the
 *                     Barangay Resident ID they upload, its QR checked
 *                     against the register; a card that does not check out
 *                     is refused.
 *   THIS one          already knows exactly who is filing, because the
 *                     account is linked to a register entry. There is
 *                     nothing to match and nothing to guess: you cannot
 *                     have a portal account without being on the register.
 *
 * So the complainant's details are read off the register here and never
 * accepted from the request. A form that let the browser say who the
 * complainant is would let a resident file under somebody else's name.
 */
class ComplaintController extends PortalController
{
    /** Their own submissions, so a reference number can be followed. */
    public function index()
    {
        $complaints = OnlineComplaint::where('resident_id', $this->residentId())
            ->with('luponCase:id,case_number,current_stage,payment_status,payment_due_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (OnlineComplaint $c) => [
                'reference_no' => $c->reference_no,
                'status' => $c->status,
                'respondent_name' => $c->respondent_name,
                'filed_at' => $c->created_at?->toDateString(),
                /* The one field that answers "did anything happen?" — a case
                   number, or nothing yet. */
                'case_number' => $c->luponCase?->case_number,
                /* The filing fee's three days, said where they file from. */
                'fee_status' => $c->luponCase?->payment_status,
                'fee_due_at' => $c->luponCase?->payment_due_at?->toIso8601String(),
                'case_stage' => $c->luponCase?->current_stage,
                /* Why it was not accepted. The complainant is told this;
                   keeping it from them would leave them waiting on a
                   decision that has already been made. */
                'office_notes' => $c->status === OnlineComplaint::REJECTED ? $c->office_notes : null,
            ]);

        return $this->success($complaints, 'Your online complaints');
    }

    public function store(FileComplaintFromPortalRequest $request, OnlineFiling $filing, JurisdictionScreen $screen, ResidentCards $cards)
    {
        $resident = Resident::find($this->residentId());

        if (! $resident) {
            return $this->notFound('No resident record is linked to your account');
        }

        $data = $request->validated();

        /*
         * THE SAME HARD BLOCK THE COUNTER HAS, AT THE DOOR.
         *
         * KP mediation is prohibited for violence against women and
         * children, and the narrative must not be WRITTEN here either: this
         * is an ordinary intake table, and the VAWC desk's own records are
         * encrypted at rest precisely because a survivor's account is not
         * ordinary data.
         *
         * It matters more on the portal than on the public form. A portal is
         * opened on a phone somebody may share with the person they live
         * with, and a complaint of being beaten sitting in this resident's
         * own "my complaints" list is a disclosure to whoever picks up that
         * phone next.
         */
        if ($screen->mentionsVawc($data['narrative'], $data['respondent_name'])) {
            return $this->error(
                'This appears to involve violence against a woman or a child. The Katarungang '
                    . 'Pambarangay cannot mediate these, and it is not safe to file one here. Please go '
                    . 'to the Barangay VAWC Desk, or call the barangay hall — they will help you today.',
                422,
                ['routed_to' => 'VAWC']
            );
        }

        /*
         * Their own Barangay Resident ID: valid, current, and THEIRS. The
         * account already says who they are; the card is what the counter
         * checks them against, so it has to be the card of this account.
         */
        $check = $cards->verify($data['resident_card_code']);
        if ($check['ok'] && $check['resident']->id !== $resident->id) {
            $check = ['ok' => false, 'message' => 'This Resident ID belongs to another resident. Upload your own — you can download it from My Profile.'];
        }
        if (! $check['ok']) {
            return $this->error($check['message'], 422, ['resident_card_code' => [$check['message']]]);
        }

        $complaint = $filing->file([
            ...$data,
            'filer_kind' => 'Resident',
            /* From the register, never from the request. */
            'resident_id' => $resident->id,
            'resident_card_id' => $check['card']->id,
            'valid_id_type' => FileOnlineComplaintRequest::RESIDENT_CARD,
            'valid_id_number' => $resident->resident_number,
            'complainant_name' => $resident->full_name,
            'complainant_address' => $resident->address ?: ($resident->zone_purok ?: 'Barangay Natumolan'),
            /* The number they gave — filled in from the record on the page — or the record's. */
            'complainant_contact' => trim((string) ($data['complainant_contact'] ?? '')) ?: ($resident->contact_number ?: 'Not on record'),
        ], $request->file('valid_id'), $request->file('evidence') ?? []);

        return $this->success([
            'reference_no' => $complaint->reference_no,
            'status' => $complaint->status,
        ], 'Your complaint was received as ' . $complaint->reference_no . '. This is a reference number, '
            . 'not a case number. Please visit the Barangay Office with the ID you uploaded — the '
            . 'complaint is verified there, any fee is paid there, and the Lupon accepts it into the '
            . 'Katarungang Pambarangay process once that is done.', 201);
    }
}
