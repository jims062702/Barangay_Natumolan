<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\SeniorCheck;
use App\Support\DateWindow;
use App\Support\ManilaTime;
use Illuminate\Http\Request;

/**
 * The station's senior-check day-list: a line written at a table for
 * somebody standing in front of you, read back as a sequence.
 *
 * The prenatal register that sat beside it moved to PrenatalController,
 * because a prenatal line now belongs to a pregnancy and is counted
 * against it — which a day-list is not.
 */
class RegisterController extends BaseController
{
    private const PATIENT_COLUMNS =
        'id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,birthdate,contact_number';

    public function seniors(Request $request)
    {
        $query = SeniorCheck::with(['senior:' . self::PATIENT_COLUMNS, 'recorder:id,name']);

        if ($request->filled('senior_id')) {
            $query->where('senior_id', $request->senior_id);
        }

        return $this->paged($request, $query, 'check_date', SeniorCheck::min('check_date'),
            'Senior checks retrieved');
    }

    public function storeSenior(Request $request)
    {
        $validated = $request->validate([
            'senior_id' => 'required|exists:residents,id',
            /* Manila's today: the server's "today" is UTC, and a check
               written before 8 in the morning was refused as the future. */
            'check_date' => 'required|date|before_or_equal:' . ManilaTime::today(),
            'age' => 'nullable|integer|min:0|max:120',
            /* "120/80" — two numbers and a slash, which is how it is said. */
            'blood_pressure' => ['nullable', 'string', 'max:20', 'regex:/^\d{2,3}\s*\/\s*\d{2,3}$/'],
            'notes' => 'nullable|string',
        ], [
            'check_date.before_or_equal' => 'A check cannot be recorded in the future.',
            'blood_pressure.regex' => 'Write the reading as systolic/diastolic, e.g. 120/80.',
        ]);

        $validated['recorded_by'] = auth()->id();

        $check = SeniorCheck::create($validated);

        return $this->success(
            $check->load(['senior:' . self::PATIENT_COLUMNS, 'recorder:id,name']),
            'Check recorded',
            201
        );
    }

    /**
     * The same page shape both lists are read through.
     *
     * Period counts BEFORE the window is applied, so the chips say how many
     * sit in each stretch of time rather than how many survived the one
     * already chosen.
     */
    private function paged(Request $request, $query, string $column, $earliest, string $message)
    {
        $counts = DateWindow::counts($query, $column, dateOnly: true);

        $window = DateWindow::fromRequest($request);
        $window?->applyTo($query, $column, dateOnly: true);

        $page = $query->orderByDesc($column)->orderByDesc('id')->paginate(20);

        $payload = $page->toArray();
        $payload['window'] = $window?->toArray();
        $payload['period_counts'] = $counts;
        $payload['years'] = DateWindow::yearsFrom($earliest);

        return $this->success($payload, $message);
    }
}
