<?php

namespace App\Http\Controllers\Api\Health;

use App\Http\Controllers\Api\BaseController;
use App\Models\Health\AnimalBiteReferral;
use App\Support\DateWindow;
use Illuminate\Http\Request;

/**
 * The animal-bite referral register.
 *
 * Index and store, and a note on whether the person actually went. No
 * treatment endpoints, because the station gives no treatment: the rabies
 * series happens at an Animal Bite Treatment Centre and this record exists to
 * show the barangay sent them there.
 */
class AnimalBiteController extends BaseController
{
    public function index(Request $request)
    {
        $query = AnimalBiteReferral::with([
            'patient:id,resident_number,first_name,middle_name,last_name,suffix,zone_purok,birthdate,gender',
            'referrer:id,name',
        ]);

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->patient_id);
        }

        /*
         * "Who have we not heard back about?" — the question the register is
         * actually worked from. A referral nobody followed up is the one that
         * needs a visit, and it is invisible in a list ordered by date alone.
         */
        if ($request->boolean('unconfirmed')) {
            $query->whereNull('attended');
        }

        /* Counted before the window narrows anything, so the chips read of
           the whole register rather than of whatever is on screen. */
        $counts = DateWindow::counts($query, 'bite_date', dateOnly: true);

        $window = DateWindow::fromRequest($request);
        $window?->applyTo($query, 'bite_date', dateOnly: true);

        $page = $query->orderByDesc('bite_date')->orderByDesc('id')->paginate(20);

        $payload = $page->toArray();
        $payload['window'] = $window?->toArray();
        $payload['period_counts'] = $counts;
        $payload['years'] = DateWindow::yearsFrom(AnimalBiteReferral::min('bite_date'));

        return $this->success($payload, 'Animal bite referrals retrieved');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'patient_id' => 'required|exists:residents,id',
            'bite_date' => 'required|date|before_or_equal:today',
            'bite_time' => 'nullable|date_format:H:i',
            'place_of_incident' => 'nullable|string|max:255',
            'animal' => 'required|string|max:40',
            'animal_status' => 'required|in:' . implode(',', AnimalBiteReferral::ANIMAL_STATUSES),
            'animal_vaccinated' => 'nullable|boolean',
            'exposure_category' => 'nullable|string|max:20',
            'wound_description' => 'nullable|string',
            'wound_washed' => 'boolean',
            /* Required: a referral with nowhere to go is not a referral. */
            'referred_to' => 'required|string|max:150',
            'referred_on' => 'required|date|before_or_equal:today',
            'notes' => 'nullable|string',
        ], [
            'bite_date.before_or_equal' => 'The bite cannot have happened in the future.',
            'referred_to.required' => 'Name the treatment centre they were sent to.',
        ]);

        $validated['referred_by'] = auth()->id();

        $referral = AnimalBiteReferral::create($validated);

        return $this->success(
            $referral->load(['patient:id,resident_number,first_name,last_name', 'referrer:id,name']),
            'Referral recorded',
            201
        );
    }

    /** "Did they go?" — answered later, by whoever finds out. */
    public function attendance(Request $request, AnimalBiteReferral $referral)
    {
        $validated = $request->validate([
            'attended' => 'required|boolean',
            'notes' => 'nullable|string',
        ]);

        $referral->update($validated);

        return $this->success($referral, $validated['attended']
            ? 'Recorded as attended.'
            : 'Recorded as not attended — follow this one up.');
    }
}
