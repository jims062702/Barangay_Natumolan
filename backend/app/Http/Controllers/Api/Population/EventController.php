<?php

namespace App\Http\Controllers\Api\Population;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Population\StoreEventRequest;
use App\Http\Requests\Population\VerifyEventRequest;
use App\Models\Population\Event;
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

        return $this->success($event, 'Population event recorded', 201);
    }

    public function verify(VerifyEventRequest $request, Event $event)
    {
        $validated = $request->validated();

        $event->update($validated);

        return $this->success($event, 'Event verification updated');
    }
}
