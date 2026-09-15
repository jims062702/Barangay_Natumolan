<?php

namespace App\Services\Vawc;

use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Support\DateWindow;

/**
 * Opening a case from the intake form.
 *
 * The form sends one flat set of answers; the record keeps them in three
 * places — the case, its first incident, and the dependents — and in the
 * shapes the rest of the desk reads.
 */
final class CaseIntake
{
    /** @param array $validated the answers from StoreCaseRequest */
    public function open(array $validated): CaseFile
    {
        $narrative = $validated['incident_narrative'] ?? null;

        /*
         * The incident's own facts go on the incident, not the case: a case
         * outlives one night, and a second incident on the same case has its
         * own when and where.
         */
        $incident = [
            /* Posted as Manila wall time by the form; stored as UTC like
               everything else the app writes with now(). */
            'occurred_at' => isset($validated['occurred_at'])
                ? DateWindow::manilaToUtc($validated['occurred_at'])
                : null,
            'location' => $validated['incident_location'] ?? null,
            'is_ongoing' => $validated['is_ongoing'] ?? null,
            'offender_nearby' => $validated['offender_nearby'] ?? null,
        ];

        unset(
            $validated['incident_narrative'],
            $validated['occurred_at'],
            $validated['incident_location'],
            $validated['is_ongoing'],
            $validated['offender_nearby'],
        );

        /*
         * The needs list, kept as text in the encrypted column it already
         * lived in. "Other" is appended rather than dropped: a need nobody
         * anticipated is exactly the one worth reading.
         */
        $needs = collect($validated['immediate_needs'] ?? [])->filter()->values();
        $other = trim((string) ($validated['immediate_needs_other'] ?? ''));

        if ($other !== '') { $needs->push('Other: ' . $other); }
        unset($validated['immediate_needs_other']);

        $validated['immediate_needs'] = $needs->isEmpty() ? null : $needs->join("\n");

        $dependentIds = collect($validated['dependent_ids'] ?? [])->unique()->values();
        unset($validated['dependent_ids']);
        // The count always mirrors who was actually picked.
        $validated['children_count'] = $dependentIds->count();
        $validated['children_involved'] = $dependentIds->isNotEmpty();

        $validated['case_code'] = CaseFile::nextCaseCode();
        /*
         * Manila in, UTC stored.
         *
         * The form posts the clerk's own wall clock and the validation checks
         * it against Manila's — but the column is UTC, which is what now()
         * writes on the line this replaces. Storing the Manila string verbatim
         * put those two eight hours apart in the same column.
         */
        $validated['report_date'] = isset($validated['report_date'])
            ? DateWindow::manilaToUtc($validated['report_date'])
            : now();
        $validated['assigned_vawc_officer'] = auth()->id();

        // When the level was judged, so a stale assessment is visibly stale.
        if (!empty($validated['risk_level'])) {
            $validated['risk_assessed_at'] = now();
        }

        $case = CaseFile::create($validated);
        $case->dependents()->sync($dependentIds);

        /*
         * An incident row is written whenever ANY of it was answered — not
         * only when a narrative was typed. "He is in the house right now"
         * with no narrative is still the most important thing on the form.
         */
        if ($narrative || array_filter($incident, fn ($v) => $v !== null)) {
            $case->incidents()->create($incident + [
                'incident_narrative' => $narrative,
                'is_confidential' => true,
            ]);
        }

        AccessLog::record($case->id, 'created', 'Case intake');

        return $case;
    }
}
