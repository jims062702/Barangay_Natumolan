<?php

namespace App\Http\Controllers\Api\Council;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Council\StoreOfficialRequest;
use App\Http\Requests\Council\UpdateOfficialRequest;
use App\Models\Council\Official;
use App\Services\Council\OfficialPositions;
use App\Support\LandingCache;
use App\Support\PublicUpload;
use Illuminate\Http\Request;

/**
 * Barangay + SK officials shown on the landing page — managed by SK.
 */
class OfficialController extends BaseController
{
    public function __construct(private readonly OfficialPositions $positions)
    {
    }

    public function index(Request $request)
    {
        $query = Official::ordered();
        if ($request->filled('group')) {
            $query->where('group', $request->group);
        }

        return $this->success($query->get(), 'Officials retrieved');
    }

    public function store(StoreOfficialRequest $request)
    {
        $validated = $request->validated();

        if (! $this->positions->belongsTo($validated['group'], $validated['position'])) {
            return $this->error('That position is not valid for the selected group.', 422);
        }

        if ($error = $this->positions->limitError($validated['group'], $validated['position'])) {
            return $this->error($error, 422);
        }

        if ($request->hasFile('photo')) {
            $validated['photo_path'] = PublicUpload::store($request->file('photo'), 'officials');
        }
        unset($validated['photo']);
        $validated['sort_order'] = $this->positions->priority($validated['position']);
        $validated['is_active'] = true;

        $official = Official::create($validated);
        LandingCache::clearOfficials();

        return $this->success($official, 'Official added', 201);
    }

    public function update(UpdateOfficialRequest $request, Official $official)
    {
        $validated = $request->validated();

        $group = $validated['group'] ?? $official->group;
        $position = $validated['position'] ?? $official->position;

        if (! $this->positions->belongsTo($group, $position)) {
            return $this->error('That position is not valid for the selected group.', 422);
        }

        if ($error = $this->positions->limitError($group, $position, $official->id)) {
            return $this->error($error, 422);
        }

        if ($request->hasFile('photo')) {
            $validated['photo_path'] = PublicUpload::replace($official->photo_path, $request->file('photo'), 'officials');
        }
        unset($validated['photo']);
        $validated['sort_order'] = $this->positions->priority($position);

        $official->update($validated);
        LandingCache::clearOfficials();

        return $this->success($official, 'Official updated');
    }

    public function destroy(Official $official)
    {
        PublicUpload::delete($official->photo_path);
        $official->delete();
        LandingCache::clearOfficials();

        return $this->success(null, 'Official removed');
    }
}
