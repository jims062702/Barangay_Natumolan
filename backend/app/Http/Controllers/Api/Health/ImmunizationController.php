<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Health\StoreImmunizationRequest;
use App\Models\Health\ImmunizationRecord;
use App\Models\Resident\Resident;
use Illuminate\Http\Request;

/**
 * Vaccinations given, pending and missed, and a child's standing across them.
 */
class ImmunizationController extends BaseController
{
    public function index(Request $request)
    {
        $query = ImmunizationRecord::with(['child:id,resident_number,first_name,last_name,birthdate']);

        // Counted before the status filter narrows it — see statusCounts.
        $counts = $this->statusCounts($query);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return $this->success(
            $query->orderByDesc('vaccination_date')->paginate(20)->toArray()
                + ['counts' => $counts],
            'Immunization records retrieved'
        );
    }

    public function store(StoreImmunizationRequest $request)
    {
        $validated = $request->validated();

        $validated['administered_by'] = auth()->id();

        $record = ImmunizationRecord::create($validated);

        return $this->success($record, 'Immunization recorded', 201);
    }

    public function status(Resident $resident)
    {
        $immunizations = ImmunizationRecord::where('child_id', $resident->id)->get();

        $completed = $immunizations->where('status', 'Completed')->count();
        $pending = $immunizations->where('status', 'Pending')->count();
        $missed = $immunizations->where('status', 'Missed')->count();

        return $this->success([
            'child_id' => $resident->id,
            'child_name' => $resident->full_name,
            'total_vaccines' => $immunizations->count(),
            'completed' => $completed,
            'pending' => $pending,
            'missed' => $missed,
            'immunization_status' => $pending === 0 && $missed === 0 && $completed > 0
                ? 'Fully Immunized'
                : 'Incomplete',
            'records' => $immunizations,
        ], 'Immunization status retrieved');
    }
}
