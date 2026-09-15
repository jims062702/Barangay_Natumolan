<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Health\StoreChildHealthRequest;
use App\Models\Health\ChildRecord;
use Illuminate\Http\Request;

/**
 * One child health record per child: birth, growth and nutrition.
 */
class ChildHealthController extends BaseController
{
    public function index(Request $request)
    {
        $query = ChildRecord::with('child:id,resident_number,first_name,last_name,birthdate');

        if ($request->filled('nutritional_status')) {
            $query->where('nutritional_status', $request->nutritional_status);
        }

        return $this->success($query->latest()->paginate(20), 'Child health records retrieved');
    }

    public function store(StoreChildHealthRequest $request)
    {
        $validated = $request->validated();

        $childHealth = ChildRecord::updateOrCreate(
            ['child_id' => $validated['child_id']],
            $validated
        );

        return $this->success($childHealth, 'Child health recorded', 201);
    }
}
