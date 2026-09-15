<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Http\Requests\Health\StoreMaternalHealthRequest;
use App\Models\Health\MaternalRecord;
use Illuminate\Http\Request;

/**
 * One maternal record per mother: registration, prenatal visits, delivery.
 */
class MaternalHealthController extends BaseController
{
    public function index(Request $request)
    {
        $query = MaternalRecord::with('mother:id,resident_number,first_name,last_name,birthdate');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return $this->success(
            $query->orderByDesc('pregnancy_registration_date')->paginate(20),
            'Maternal health records retrieved'
        );
    }

    public function store(StoreMaternalHealthRequest $request)
    {
        $validated = $request->validated();

        $maternal = MaternalRecord::updateOrCreate(
            ['mother_id' => $validated['mother_id']],
            $validated
        );

        return $this->success($maternal, 'Maternal health recorded', 201);
    }
}
