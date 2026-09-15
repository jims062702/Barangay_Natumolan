<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use Illuminate\Http\Request;

/**
 * The access trail: who opened or changed a case, and when.
 */
class AccessLogController extends BaseController
{
    /** 2.4 — the complete access trail, every case, newest first. */
    public function index(Request $request)
    {
        $query = AccessLog::with(['vawcCase:id,case_code', 'user:id,name']);

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        return $this->success(
            $query->latest()->paginate(50),
            'Access trail retrieved'
        );
    }

    public function forCase(CaseFile $case)
    {
        return $this->success(
            $case->accessLogs()->with('user:id,name')->latest()->paginate(50),
            'Access logs retrieved'
        );
    }
}
