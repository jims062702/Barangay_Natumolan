<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\PrenatalVisit;
use App\Models\Health\SeniorCheck;
use App\Support\DateWindow;
use Illuminate\Http\Request;

/**
 * The station's two running day-lists: prenatal visits, and senior checks.
 *
 * ONE CONTROLLER, because they are one kind of thing — a line written at a
 * table for somebody standing in front of you, read back as a sequence. Two
 * controllers would be two copies of the same four methods differing only in
 * which model they name.
 *
 * Neither is a case file. The pregnancy itself lives in `maternal_health`;
 * this is the list of who came today.
 */
class RegisterController extends BaseController
{
    private const PATIENT_COLUMNS =
        'id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,birthdate,contact_number';

    public function prenatal(Request $request)
    {
        $query = PrenatalVisit::with(['mother:' . self::PATIENT_COLUMNS, 'recorder:id,name']);

        if ($request->filled('mother_id')) {
            $query->where('mother_id', $request->mother_id);
        }

        return $this->paged($request, $query, 'visit_date', PrenatalVisit::min('visit_date'),
            'Prenatal visits retrieved');
    }

    public function storePrenatal(Request $request)
    {
        $validated = $request->validate([
            'mother_id' => 'required|exists:residents,id',
            'visit_date' => 'required|date|before_or_equal:today',
            'age' => 'nullable|integer|min:0|max:120',
            'zone_purok' => 'nullable|string|max:60',
            'contact_number' => 'nullable|string|max:30',
            'complaint' => 'nullable|string',
        ], [
            'visit_date.before_or_equal' => 'A visit cannot be recorded in the future.',
        ]);

        $validated['recorded_by'] = auth()->id();

        $visit = PrenatalVisit::create($validated);

        return $this->success(
            $visit->load(['mother:' . self::PATIENT_COLUMNS, 'recorder:id,name']),
            'Prenatal visit recorded',
            201
        );
    }

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
            'check_date' => 'required|date|before_or_equal:today',
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
