<?php

namespace App\Http\Controllers\Api\Vawc;

use App\Http\Controllers\Api\BaseController;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\ChildWelfare;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Child and dependent welfare on a case — only where the case has children
 * or dependents.
 *
 * Each child's row is keyed to the dependent's resident record, and carries
 * the name as it was when saved, so the row still reads if that record is
 * later merged away.
 */
class ChildWelfareController extends BaseController
{
    public function store(Request $request, CaseFile $case)
    {
        $dependentIds = $case->dependents()->pluck('residents.id')->all();

        if ($dependentIds === []) {
            return $this->error(
                'This case has no children or dependents recorded. Add them to the case first.',
                422
            );
        }

        $validated = $request->validate([
            'children' => ['nullable', 'array'],
            'children.*.resident_id' => ['required', 'integer', Rule::in($dependentIds)],
            'children.*.name' => ['required', 'string', 'max:150'],
            'children.*.relationship' => ['nullable', 'string', 'max:60'],
            'children.*.caregiver' => ['nullable', 'string', 'max:150'],
            'children.*.living_arrangement' => ['nullable', 'string', 'max:100'],
            'children.*.immediate_needs' => ['nullable', 'string', 'max:500'],
            'support_needed' => ['nullable', Rule::in(['Yes', 'No', 'Unknown'])],
            'support_types' => ['nullable', 'array'],
            'support_types.*' => ['string', Rule::in(ChildWelfare::SUPPORT_TYPES)],
            'current_support' => ['nullable', Rule::in(['Regular', 'Irregular', 'None', 'Unknown'])],
            'referral_needed' => ['nullable', 'array'],
            'referral_needed.*' => ['string', Rule::in(ChildWelfare::REFERRALS)],
            'referral_other' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ], [
            'children.*.resident_id.in' => 'Every child listed must be one of the case\'s dependents.',
        ]);

        /* The kinds of support only mean something when support is needed. */
        if (($validated['support_needed'] ?? null) !== 'Yes') {
            $validated['support_types'] = [];
        }
        $validated['support_types'] = array_values(array_intersect(
            ChildWelfare::SUPPORT_TYPES, $validated['support_types'] ?? []
        ));
        $validated['referral_needed'] = array_values(array_intersect(
            ChildWelfare::REFERRALS, $validated['referral_needed'] ?? []
        ));
        if (! in_array('Other', $validated['referral_needed'], true)) {
            $validated['referral_other'] = null;
        }
        $validated['children'] = collect($validated['children'] ?? [])->unique('resident_id')->values()->all();

        $welfare = ChildWelfare::updateOrCreate(
            ['vawc_case_id' => $case->id],
            $validated + ['recorded_by' => auth()->id()]
        );

        AccessLog::record(
            $case->id,
            $welfare->wasRecentlyCreated ? 'child_welfare_recorded' : 'child_welfare_updated',
            'Child & dependent welfare'
        );

        return $this->success(
            $welfare->fresh()->load('recorder:id,name'),
            'Child and dependent welfare saved.'
        );
    }
}
