<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Health\StoreVisitRequest;
use App\Models\Health\Visit;
use Illuminate\Http\Request;

/**
 * Consultations at the Barangay Health Station.
 */
class VisitController extends BaseController
{
    public function index(Request $request)
    {
        $query = Visit::with(['patient:id,resident_number,first_name,last_name', 'provider:id,name']);

        if ($request->filled('date')) {
            $query->whereDate('visit_date', $request->date);
        }
        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->patient_id);
        }

        return $this->success($query->orderByDesc('visit_date')->paginate(20), 'Health visits retrieved');
    }

    public function store(StoreVisitRequest $request)
    {
        $validated = $request->validated();

        $validated['service_provider_id'] = auth()->id();

        $visit = Visit::create($validated);

        return $this->success($visit, 'Health visit recorded', 201);
    }
}
