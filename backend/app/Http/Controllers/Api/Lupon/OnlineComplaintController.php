<?php

namespace App\Http\Controllers\Api\Lupon;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Lupon\FileOnlineComplaintRequest;
use App\Models\Lupon\CaseFile;
use App\Models\Lupon\OnlineComplaint;
use App\Models\Resident\Resident;
use App\Services\Lupon\FilingFeeDeadlines;
use App\Services\Lupon\JurisdictionScreen;
use App\Services\Lupon\OnlineFiling;
use App\Services\Resident\ResidentCards;
use App\Support\ChangeLog;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Complaints begun online, and what the office does with them.
 *
 * THE ONE RULE THIS FILE EXISTS TO HOLD: an online submission is not a
 * case. It is a queue. The complainant still comes to the barangay, is
 * still identified against the ID they uploaded, the complaint is still
 * read, the fee is still paid — and only when the Lupon presses Accept does
 * a case exist. What the office gains is reading the thing before the
 * person is standing at the counter; what it does not give up is any part
 * of the process.
 *
 * So `accept()` is the only method here that writes to the docket, and it
 * is the only place a reference number (OC-2026-0007) becomes a case number
 * (2026-09-25-03).
 */
class OnlineComplaintController extends BaseController
{
    /**
     * Anybody may begin one: the public page and the resident's portal both
     * arrive here.
     *
     * Not throttled — see routes/api/public.php for why a limit per address
     * turned away people sharing the barangay hall's wifi. The valid ID is
     * what each submission must still carry.
     */
    public function store(FileOnlineComplaintRequest $request, OnlineFiling $filing, JurisdictionScreen $screen, ResidentCards $cards)
    {
        $data = $request->validated();

        /*
         * THE SAME HARD BLOCK THE COUNTER HAS, AT THE DOOR.
         *
         * KP mediation is prohibited for violence against women and
         * children, so a complaint that reads that way must not enter this
         * queue — and the narrative must not be WRITTEN here either. This
         * table is an ordinary intake table; the VAWC desk's own records
         * are encrypted at rest precisely because a survivor's account is
         * not ordinary data. Refusing at the door means nothing about her
         * is stored in the wrong place, and she is told where to go.
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
         * A RESIDENT IS WHO THEIR BARANGAY RESIDENT ID SAYS THEY ARE.
         *
         * The code its QR carries (read from the picture they uploaded) is
         * checked against the register: a card this barangay issued, still
         * their current one, held by somebody still living here. Checked, the
         * complaint is attached to that record and their name and address are
         * read off it. Not checked, it is refused here — before anything is
         * kept or a picture is stored — and nobody is created or changed.
         * Somebody who does not live here files as a non-resident.
         */
        $data['resident_id'] = null;
        if ($data['filer_kind'] === 'Resident') {
            $check = $cards->verify($data['resident_card_code'] ?? null);

            if (! $check['ok']) {
                return $this->error($check['message'], 422, ['resident_card_code' => [$check['message']]]);
            }

            $resident = $check['resident'];
            $data['resident_id'] = $resident->id;
            $data['resident_card_id'] = $check['card']->id;
            $data['complainant_name'] = $resident->full_name;
            $data['complainant_address'] = ResidentCards::completeAddress($resident);
            $data['valid_id_type'] = FileOnlineComplaintRequest::RESIDENT_CARD;
            $data['valid_id_number'] = $resident->resident_number;
        }

        $complaint = $filing->file($data, $request->file('valid_id'), $request->file('evidence') ?? []);

        /* What the barangay says back: where to go next. */
        return $this->success([
            'reference_no' => $complaint->reference_no,
            'status' => $complaint->status,
        ], 'Your complaint was received as ' . $complaint->reference_no . '. Please visit the '
            . 'Barangay Office with the ID you uploaded. The complaint is verified there, any fee '
            . 'is paid there, and the Lupon accepts it into the Katarungang Pambarangay process '
            . 'once that is done.', 201);
    }

    /**
     * The office's queue — in reference order, and searchable.
     *
     * NEWEST FIRST, BY THE REFERENCE'S OWN NUMBERS. OC-2026-0010 is after
     * OC-2026-0009, not between OC-2026-0001 and OC-2026-0002 as a string sort
     * would put it: the year and the sequence are compared as numbers, and
     * the id breaks any tie. (It used to put the waiting ones first, which
     * scrambled the references for anybody reading down the column; the
     * status filter and the badge are how the waiting ones are found now.)
     *
     * SEARCH covers the reference, the complainant, the respondent, the
     * Nature of the Case (theirs, or the case's once accepted), the case
     * number and the status — on the server, so it searches every page, and
     * the pages that come back are of the matches.
     */
    public function index(Request $request)
    {
        $term = trim((string) $request->input('q', ''));

        $query = OnlineComplaint::with(['resident:id,first_name,middle_name,last_name', 'files', 'luponCase:id,case_number,case_classification,current_stage'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('filer_kind'), fn ($q) => $q->where('filer_kind', $request->filer_kind))
            ->when($term !== '', function ($q) use ($term) {
                $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term) . '%';
                $q->where(fn ($w) => $w
                    ->where('reference_no', 'like', $like)
                    ->orWhere('complainant_name', 'like', $like)
                    ->orWhere('respondent_name', 'like', $like)
                    ->orWhere('case_classification', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhereHas('luponCase', fn ($c) => $c->where('case_number', 'like', $like)
                        ->orWhere('case_classification', 'like', $like)));
            })
            ->orderByRaw("CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(reference_no, '-', 2), '-', -1) AS UNSIGNED) DESC")
            ->orderByRaw("CAST(SUBSTRING_INDEX(reference_no, '-', -1) AS UNSIGNED) DESC")
            ->orderByDesc('id');

        return $this->success($query->paginate(20)->withQueryString(), 'Online complaints retrieved');
    }

    /**
     * The identity document, handed to the officer at the counter.
     *
     * Streamed from the private disk and never linked publicly: it is a
     * photograph of somebody's identity card, and the only reason it exists
     * is for one officer to hold it beside the person's face.
     */
    public function validId(OnlineComplaint $complaint)
    {
        if (! Storage::disk('local')->exists($complaint->valid_id_path)) {
            return $this->notFound('The uploaded ID is no longer on file.');
        }

        return Storage::disk('local')->response($complaint->valid_id_path);
    }

    /**
     * THE MOMENT A REFERENCE NUMBER BECOMES A CASE NUMBER.
     *
     * Pressed by the Lupon, at the counter, with the complainant in front
     * of them and the ID checked. Everything before this was a queue.
     *
     * A resident's complaint reaches this queue only after their Barangay
     * Resident ID checked out at the door, so it is already on their
     * record; a non-resident's carries their details as typed.
     *
     * The case this raises is Filed, and its filing fee is owed from now:
     * three calendar days, or it closes unpaid (FilingFeeDeadlines).
     */
    public function accept(Request $request, OnlineComplaint $complaint, JurisdictionScreen $screen)
    {
        if ($complaint->status !== OnlineComplaint::FOR_VERIFICATION) {
            return $this->error('This complaint is already ' . strtolower($complaint->status) . '.', 422);
        }

        /* Nature of the Case, and no separate title: the case is named by its
           nature, as it is at the counter (File Complaint). */
        $validated = $request->validate([
            'case_classification' => ['required', 'string', 'in:' . implode(',', CaseFile::NATURES)],
            /*
             * The respondent, ON THE REGISTER — required, as at the counter
             * (StoreCaseRequest). The website only had a typed name; a summons
             * is served on a person, and the docket lists who is chosen here.
             */
            'respondent_ids' => ['required', 'array', 'min:1'],
            'respondent_ids.*' => ['integer', 'exists:residents,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'case_classification.required' => 'Choose the Nature of the Case.',
            'case_classification.in' => 'Choose the Nature of the Case from the list.',
            'respondent_ids.required' => 'Choose the respondent on the register — search for the person the complaint is against.',
            'respondent_ids.min' => 'Choose the respondent on the register — search for the person the complaint is against.',
        ]);

        /* Nobody is both sides of one dispute. */
        if ($complaint->resident_id && in_array((int) $complaint->resident_id, array_map('intval', $validated['respondent_ids']), true)) {
            return $this->error('The complainant cannot also be the respondent.', 422,
                ['respondent_ids' => ['The complainant cannot also be the respondent.']]);
        }

        /*
         * The counter's rule (CaseController::store): KP jurisdiction follows
         * where the RESPONDENT lives, and `exists:residents` lets a
         * non-resident record through.
         */
        $outsiders = Resident::whereIn('id', $validated['respondent_ids'])
            ->where('record_type', Resident::NON_RESIDENT)
            ->pluck('first_name')
            ->all();

        if ($outsiders !== []) {
            return $this->error(
                implode(', ', $outsiders) . ' ' . (count($outsiders) === 1 ? 'is' : 'are')
                    . ' recorded as living outside Barangay Natumolan. The Lupon can only hear a case '
                    . 'whose respondent lives here.',
                422,
                ['respondent_ids' => ['Each respondent must be a barangay resident.']]
            );
        }

        /* And again here, for anything that slipped past the door: the
           docket is the place this must never reach. */
        if ($screen->mentionsVawc($complaint->narrative, $complaint->respondent_name)) {
            return $this->error(
                'This complaint appears to involve violence against women/children. KP mediation is '
                    . 'prohibited for VAWC cases — route the complainant to the VAWC Desk immediately.',
                422,
                ['routed_to' => 'VAWC']
            );
        }

        $today = ManilaTime::today();

        $case = CaseFile::create([
            'case_number' => CaseFile::nextCaseNumber($today),
            /* Named by its nature — one field, as at the counter. */
            'case_title' => $validated['case_classification'],
            'case_classification' => $validated['case_classification'],
            'complainant_id' => $complaint->resident_id,
            /* A non-resident complainant has no register record, so the case
               carries their details as typed. */
            'complainant_name' => $complaint->resident_id ? null : $complaint->complainant_name,
            'complainant_address' => $complaint->resident_id ? null : $complaint->complainant_address,
            /*
             * The number they gave for THIS complaint — kept on the case for a
             * resident too (their record often has none, and the docket showed
             * nothing). The portal writes "Not on record" when it had none to
             * send; that is not a number.
             */
            'complainant_contact' => $complaint->complainant_contact && $complaint->complainant_contact !== 'Not on record'
                ? $complaint->complainant_contact
                : null,
            'jurisdiction_status' => 'Accepted',
            'current_stage' => 'Filed',
            'date_filed' => $today,
            'notes' => 'Filed online as ' . $complaint->reference_no . '.',
        ]);

        $case->complaint()->create([
            'complaint_narrative' => $complaint->narrative,
            'date_of_occurrence' => $complaint->date_of_occurrence ?? $today,
            'place_of_occurrence' => $complaint->place_of_occurrence ?? 'Barangay Natumolan',
            /* The docket stores this as one of five. Unanswered online it
               is 'Other'; the Lupon fixes it on the case if the interview
               says otherwise. */
            'relationship_nature' => $complaint->relationship_nature ?: 'Other',
            /* And this is recorded honestly rather than left at its
               'Both Resident' default: a complaint filed by somebody who is
               not on the register is not a dispute between two residents,
               and the case file should not claim it was. */
            'residency_verified' => $complaint->resident_id ? 'Both Resident' : 'Partial',
            /* The day the barangay took it in. That is TODAY, at the
               counter, not the day the website was used: the office is
               accountable from the moment it accepts the complaint. */
            'complaint_received_date' => $today,
        ]);

        if (! empty($validated['respondent_ids'])) {
            $case->respondents()->sync($validated['respondent_ids']);
        }

        $complaint->update([
            'status' => OnlineComplaint::ACCEPTED,
            'lupon_case_id' => $case->id,
            'handled_by' => auth()->id(),
            'handled_at' => ManilaTime::now(),
            'office_notes' => $validated['notes'] ?? null,
        ]);

        ChangeLog::bump('lupon_cases');

        return $this->success(
            ['complaint' => $complaint->fresh('luponCase'), 'case' => $case->fresh()],
            'Accepted as case ' . $case->case_number . '. The filing fee must be paid by '
                . FilingFeeDeadlines::dueWords($case->payment_due_at) . ' (end of day) — ' . FilingFeeDeadlines::DAYS
                . ' calendar days — or the case closes unpaid. It is confirmed on the case itself.'
        );
    }

    /** Not a matter for the Lupon, or not a real complaint. */
    public function reject(Request $request, OnlineComplaint $complaint)
    {
        if ($complaint->status !== OnlineComplaint::FOR_VERIFICATION) {
            return $this->error('This complaint is already ' . strtolower($complaint->status) . '.', 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ], ['reason.required' => 'Say why it is not being accepted — the complainant is told this.']);

        $complaint->update([
            'status' => OnlineComplaint::REJECTED,
            'handled_by' => auth()->id(),
            'handled_at' => ManilaTime::now(),
            'office_notes' => $validated['reason'],
        ]);

        return $this->success($complaint->fresh(), 'Recorded as not accepted.');
    }
}
