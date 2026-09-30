<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Population\StoreEventRequest;
use App\Http\Requests\Population\VerifyEventRequest;
use App\Models\Population\Event;
use App\Services\Population\OutMigration;
use Illuminate\Http\Request;

/** Births, deaths, transfers and changes, as the office records and verifies them. */
class EventController extends BaseController
{
    public function index(Request $request)
    {
        $query = Event::with(['resident:id,resident_number,first_name,last_name', 'recorder:id,name']);

        if ($request->filled('event_type')) {
            $query->where('event_type', $request->event_type);
        }
        if ($request->filled('verification_status')) {
            $query->where('verification_status', $request->verification_status);
        }

        return $this->success($query->orderByDesc('event_date')->paginate(20), 'Population events retrieved');
    }

    public function store(StoreEventRequest $request)
    {
        $validated = $request->validated();

        $validated['recorded_by'] = auth()->id();

        $event = Event::create($validated);

        /*
         * A Transfer Out is the register saying somebody no longer lives
         * here: they leave the population figures and their portal login is
         * switched off. Said out loud in the reply — a login that stops
         * working without explanation is a resident at the counter asking
         * why.
         */
        $notes = OutMigration::apply($event->load('resident'));

        return $this->success(
            $event,
            trim('Population event recorded. ' . implode(' ', $notes)),
            201
        );
    }

    public function verify(VerifyEventRequest $request, Event $event)
    {
        $validated = $request->validated();

        $event->update($validated);

        /* Recorded first and verified later: the move takes effect either
           way, and applying it twice changes nothing. */
        $notes = OutMigration::apply($event->fresh()->load('resident'));

        return $this->success($event, trim('Event verification updated. ' . implode(' ', $notes)));
    }
}
