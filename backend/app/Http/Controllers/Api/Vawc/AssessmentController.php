<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\Assessment;
use App\Models\Vawc\CaseFile;
use App\Support\ManilaTime;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The case assessment and action plan: the victim-survivor's concerns, what
 * the desk found, the services it gave, and what happens next.
 *
 * One per case. Saving again corrects it — the plan is a living record of the
 * case, not a series of sittings.
 */
class AssessmentController extends BaseController
{
    public function store(Request $request, CaseFile $case)
    {
        $validated = $request->validate([
            'assessment_date' => ['required', 'date', 'before_or_equal:' . ManilaTime::today()],
            'persons_present' => ['nullable', 'array'],
            'persons_present.*' => ['string', Rule::in(Assessment::PERSONS_PRESENT)],
            'statement' => ['nullable', 'string', 'max:10000'],
            'observations' => ['nullable', 'string', 'max:10000'],
            'services_provided' => ['nullable', 'array'],
            'services_provided.*' => ['string', Rule::in(Assessment::SERVICES)],
            'action_plan' => ['nullable', 'string', 'max:10000'],
            'next_followup_date' => ['nullable', 'date', 'after_or_equal:assessment_date'],
            'informed_of_rights' => ['boolean'],
            'protection_order_offered' => ['boolean'],
            'referral_made' => ['boolean'],
            'next_steps_documented' => ['boolean'],
        ], [
            'assessment_date.before_or_equal' => 'An assessment cannot be dated in the future.',
            'next_followup_date.after_or_equal' => 'The next follow-up cannot be before the assessment.',
        ]);

        /* Stored in the order the form lists them, once each. */
        $validated['persons_present'] = array_values(array_intersect(
            Assessment::PERSONS_PRESENT, $validated['persons_present'] ?? []
        ));
        $validated['services_provided'] = array_values(array_intersect(
            Assessment::SERVICES, $validated['services_provided'] ?? []
        ));

        $assessment = Assessment::updateOrCreate(
            ['vawc_case_id' => $case->id],
            $validated + ['recorded_by' => auth()->id()]
        );

        AccessLog::record(
            $case->id,
            $assessment->wasRecentlyCreated ? 'assessment_recorded' : 'assessment_updated',
            'Case assessment & action plan'
        );

        return $this->success(
            $assessment->fresh()->load('recorder:id,name'),
            $assessment->wasRecentlyCreated
                ? 'Case assessment and action plan recorded.'
                : 'Case assessment and action plan updated.'
        );
    }
}
