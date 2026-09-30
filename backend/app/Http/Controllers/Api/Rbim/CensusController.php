<?php

namespace App\Http\Controllers\Api\Rbim;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Rbim\SaveCensusRequest;
use App\Models\Rbim\Census;
use App\Services\Rbim\CensusAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The RBIM baseline census — collected on paper, encoded here.
 *
 * The BHW visits each household and fills the sheet in by hand. The sheet is
 * carried to the Population Office, and the Population Office types it in.
 * Nobody but the Population Office touches this module: there is no hand-over
 * inside the system, because the hand-over already happened on paper.
 *
 * So there are two states, not three:
 *
 *   Draft      being typed. Nobody is on the register yet.
 *   Submitted  the household has been registered. Still editable — a
 *              household gains a baby, loses a head, corrects a spelling, and
 *              refusing that just moves the correction off the system.
 *
 * Submitting is what puts people on the register. Everything a census line
 * says becomes a resident record, the line is joined to it, and re-submitting
 * after an edit adds only whoever is new. It is the one door between the two,
 * and it is deliberate: a form is typed, checked, and then registered.
 */
class CensusController extends BaseController
{
    public function __construct(private readonly CensusAccess $access)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Census::with([
            'household:id,household_number,zone_purok',
            'recorder:id,name',
        ])->withCount('members');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        /* "Your drafts" — the forms this account started (Draft Available / Continue Draft). */
        if ($request->boolean('mine')) {
            $query->where('recorded_by', auth()->id());
        }

        if ($request->filled('search')) {
            $term = trim($request->input('search'));
            $query->where(function ($q) use ($term) {
                /*
                 * The address is searched in the parts it was collected in.
                 * An office looking for one house types the block or the
                 * unit, not the street it shares with forty others.
                 */
                $q->where('census_no', 'like', "%{$term}%")
                    ->orWhere('household_head_name', 'like', "%{$term}%")
                    ->orWhere('respondent_name', 'like', "%{$term}%")
                    ->orWhere('address_street', 'like', "%{$term}%")
                    ->orWhere('address_house_lot', 'like', "%{$term}%")
                    ->orWhere('address_unit', 'like', "%{$term}%");
            });
        }

        return $this->success(
            $query->latest('id')->paginate(20)->toArray() + [
                'counts' => [
                    'Draft' => Census::where('status', 'Draft')->count(),
                    'Submitted' => Census::where('status', 'Submitted')->count(),
                ],
            ],
            'RBIM census forms retrieved'
        );
    }

    public function show(Census $rbimCensus): JsonResponse
    {
        $rbimCensus->load([
            /* The birthdate and whether it is whole: a census line matched to a
               record holding only a month and a year has to give the day. */
            'members.resident:id,resident_number,first_name,last_name,birthdate,birthdate_is_estimated',
            'household:id,household_number,zone_purok,street_address',
            'recorder:id,name',
            'reviewer:id,name',
        ]);

        return $this->success($rbimCensus, 'RBIM census retrieved');
    }

    public function store(Request $request): JsonResponse
    {
        if (!$this->access->canCollect()) {
            return $this->forbidden('Your office does not collect the RBIM census');
        }

        /* A new form is always a draft. */
        $validated = $request->validate(SaveCensusRequest::fields(null, true), SaveCensusRequest::fieldMessages());

        $census = DB::transaction(function () use ($validated, $request) {
            $members = $validated['members'] ?? [];
            unset($validated['members']);

            $census = Census::create($validated + [
                // ?? not ?: — a nullable rule leaves the key ABSENT when
                // nothing was sent, and reading it directly is a 500 at the
                // doorstep.
                'census_no' => ($validated['census_no'] ?? null) ?: Census::nextNumber(),
                'recorded_by' => auth()->id(),
                'status' => 'Draft',
            ]);

            $this->writeMembers($census, $members);

            return $census;
        });

        return $this->success(
            $census->load('members'),
            'RBIM census ' . $census->census_no . ' saved as a draft.',
            201
        );
    }

    public function update(Request $request, Census $rbimCensus): JsonResponse
    {
        if (!$this->access->canCollect()) {
            return $this->forbidden('Your office does not collect the RBIM census');
        }

        /*
         * A submitted census stays editable.
         *
         * A household is not finished when the form is: a baby arrives, the
         * head dies, a name was spelt wrong at the door. Closing the form
         * would not stop any of that happening — it would only stop the
         * system hearing about it.
         */
        $validated = $request->validate(
            SaveCensusRequest::fields($rbimCensus->id, $rbimCensus->status === 'Draft'),
            SaveCensusRequest::fieldMessages()
        );

        DB::transaction(function () use ($validated, $rbimCensus) {
            $members = $validated['members'] ?? null;
            unset($validated['members']);

            $rbimCensus->update($validated);

            // Sent at all means sent whole: the grid is one answer, and a
            // partial write would leave lines from two different visits.
            if ($members !== null) {
                /*
                 * Who each line was, before the grid is rewritten.
                 *
                 * The rewrite deletes every line and writes them again, which
                 * silently threw away the resident each one had been joined
                 * to. A form edited after submitting then had every line
                 * pointing at nobody, and submitting again registered the
                 * whole household a SECOND time — four people became seven.
                 *
                 * Matched back by name, the same comparison the rest of this
                 * module uses to decide that a line and a record are one
                 * person. A line whose name was corrected loses its link and
                 * is re-matched by hand, which is right: the office has just
                 * changed who that line says it is.
                 */
                $wasMatched = $rbimCensus->members()
                    ->whereNotNull('resident_id')
                    ->get()
                    ->mapWithKeys(fn ($m) => [
                        $this->nameKey($m->first_name, $m->last_name) => $m->resident_id,
                    ]);

                $rbimCensus->members()->delete();
                $this->writeMembers($rbimCensus, $members);

                if ($wasMatched->isNotEmpty()) {
                    foreach ($rbimCensus->members()->get() as $line) {
                        $key = $this->nameKey($line->first_name, $line->last_name);

                        if ($wasMatched->has($key)) {
                            $line->update(['resident_id' => $wasMatched[$key]]);
                        }
                    }
                }
            }
        });

        return $this->success($rbimCensus->fresh()->load('members'), 'RBIM census updated');
    }

    public function destroy(Census $rbimCensus): JsonResponse
    {
        if (!$this->access->canReconcile()) {
            return $this->forbidden('Only the Population Office may delete a census form');
        }

        /*
         * A submitted census has people on the register behind it. Deleting
         * the form would leave those records with nothing saying where they
         * came from.
         */
        if ($rbimCensus->status === 'Submitted') {
            return $this->error(
                'This census has been submitted and its household registered. '
                    . 'It is part of the record and cannot be deleted.',
                409
            );
        }

        $number = $rbimCensus->census_no;
        $rbimCensus->delete();

        return $this->success(null, 'RBIM census ' . $number . ' deleted.');
    }

    /** How a census line and a resident record are said to be the same person. */
    private function nameKey(?string $first, ?string $last): string
    {
        return mb_strtolower(trim((string) $first) . '|' . trim((string) $last));
    }

    private function writeMembers(Census $census, array $members): void
    {
        foreach ($members as $index => $member) {
            /*
             * The month and year, from the date — never typed separately
             * beside it, so the two can never disagree. They are what the
             * RBIM codebook and its encoding sheet speak in.
             */
            if (! empty($member['q5_birthdate'])) {
                $member['q5_birth_month'] = (int) substr($member['q5_birthdate'], 5, 2);
                $member['q5_birth_year'] = (int) substr($member['q5_birthdate'], 0, 4);
            }

            /* A draft's line may not have reached its names yet; the columns hold "" until it does. */
            $member['first_name'] = (string) ($member['first_name'] ?? '');
            $member['last_name'] = (string) ($member['last_name'] ?? '');

            $census->members()->create($member + [
                // The line number the paper uses, kept in the order given.
                'line_no' => $member['line_no'] ?? $index + 1,
            ]);
        }
    }
}
