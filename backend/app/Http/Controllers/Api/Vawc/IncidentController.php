<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Vawc\StoreIncidentRequest;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;

/**
 * A further incident on an open case.
 */
class IncidentController extends BaseController
{
    public function store(StoreIncidentRequest $request, CaseFile $case)
    {
        if ($case->status === 'Closed') {
            return $this->error('Closed VAWC cases are read-only.', 422);
        }

        $validated = $request->validated();

        $incident = $case->incidents()->create($validated + ['is_confidential' => true]);

        AccessLog::record($case->id, 'incident_added');

        return $this->success($incident, 'Incident recorded', 201);
    }
}
