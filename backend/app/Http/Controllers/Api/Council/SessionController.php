<?php

namespace App\Http\Controllers\Api\Council;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Council\SaveSessionRequest;
use App\Models\Council\Attendee;
use App\Models\Council\Session;
use App\Support\DateWindow;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The session record — the secretary's own book.
 *
 * The secretary writes it; the Punong Barangay reads it and adopts the
 * minutes. Adoption is deliberately a separate act from writing: minutes the
 * author can mark adopted are not minutes anybody approved.
 */
class SessionController extends BaseController
{
    public function index(Request $request)
    {
        $query = Session::with('recorder:id,name')
            ->withCount([
                'attendees',
                'attendees as present_count' => fn ($q) => $q->whereIn('attendance', ['Present', 'Late']),
            ]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('session_type')) {
            $query->where('session_type', $request->session_type);
        }

        /* The same period question every other docket takes. session_date is
           a DATE, so it is compared as Manila calendar days. */
        /*
         * Counted BEFORE the window is applied, and after every other filter.
         * "Today: 3" then means three of the cases the clerk is already
         * looking at, not three in the register as a whole.
         */
        $periodCounts = DateWindow::counts($query, 'session_date', dateOnly: true);

        $window = DateWindow::fromRequest($request);
        $window?->applyTo($query, 'session_date', dateOnly: true);

        $sessions = $query->orderByDesc('session_date')->orderByDesc('id')->paginate(20);

        $payload = $sessions->toArray();
        $payload['window'] = $window?->toArray();
        $payload['years'] = DateWindow::yearsFrom(Session::min('session_date'));
        $payload['period_counts'] = $periodCounts;

        return $this->success($payload, 'Barangay sessions retrieved');
    }

    public function show(Session $barangaySession)
    {
        $barangaySession->load(['attendees', 'recorder:id,name']);

        return $this->success($barangaySession, 'Session retrieved');
    }

    public function store(SaveSessionRequest $request)
    {
        $validated = $request->validated();

        $validated['session_number'] = Session::nextNumber($validated['session_date']);
        $validated['recorded_by'] = auth()->id();

        $session = DB::transaction(function () use ($validated, $request) {
            $session = Session::create($validated);
            $this->writeAttendance($session, $request);

            return $session;
        });

        return $this->success($session->load('attendees'), 'Session recorded', 201);
    }

    public function update(Request $request, Session $barangaySession)
    {
        /*
         * Adopted minutes are closed.
         *
         * Once the council has adopted them the document is the barangay's
         * record, not the secretary's draft, and editing it afterwards would
         * change what the council approved without anybody voting on it.
         */
        if ($barangaySession->status === 'Adopted') {
            return $this->error('These minutes have been adopted and can no longer be edited.', 422);
        }

        $validated = $request->validate(SaveSessionRequest::fields(), SaveSessionRequest::fieldMessages());

        DB::transaction(function () use ($barangaySession, $validated, $request) {
            $barangaySession->update($validated);

            if ($request->has('attendees')) {
                $barangaySession->attendees()->delete();
                $this->writeAttendance($barangaySession, $request);
            }
        });

        return $this->success($barangaySession->fresh()->load('attendees'), 'Session updated');
    }

    /**
     * The council adopts the minutes.
     *
     * Gated to the Punong Barangay at the route. A secretary who could adopt
     * their own minutes would make the status mean nothing.
     */
    public function adopt(Session $barangaySession)
    {
        if ($barangaySession->status === 'Adopted') {
            return $this->error('Already adopted.', 422);
        }

        if (blank($barangaySession->minutes)) {
            return $this->error('There are no minutes to adopt yet.', 422);
        }

        $barangaySession->update([
            'status' => 'Adopted',
            'adopted_at' => now(),
        ]);

        return $this->success($barangaySession, 'Minutes adopted');
    }

    public function destroy(Session $barangaySession)
    {
        if ($barangaySession->status === 'Adopted') {
            return $this->error('Adopted minutes cannot be deleted.', 422);
        }

        $barangaySession->delete();

        return $this->success(null, 'Session deleted');
    }

    private function writeAttendance(Session $session, Request $request): void
    {
        /* The same person twice would make the present count untrue, and the
           unique index would reject the row anyway — deduplicated here so the
           clerk gets their list saved rather than a database error. */
        $seen = [];

        foreach ($request->input('attendees', []) as $row) {
            $name = trim((string) ($row['name'] ?? ''));

            if ($name === '' || isset($seen[strtolower($name)])) {
                continue;
            }

            $seen[strtolower($name)] = true;

            Attendee::create([
                'barangay_session_id' => $session->id,
                'name' => $name,
                'position' => $row['position'] ?? null,
                'attendance' => $row['attendance'] ?? 'Present',
                'remarks' => $row['remarks'] ?? null,
            ]);
        }
    }
}
