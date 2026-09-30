<?php

namespace App\Services\Vawc;

use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Support\DateWindow;
use Illuminate\Support\Facades\DB;

/**
 * Opening a case from the intake form.
 *
 * The form sends one flat set of answers; the record keeps them in four
 * places — the case, its first incident, the dependents, and the protection
 * order when one is needed — and in the shapes the rest of the desk reads.
 */
final class CaseIntake
{
    /** @param array $validated the answers from StoreCaseRequest */
    public function open(array $validated): CaseFile
    {
        return DB::transaction(fn () => $this->file($validated));
    }

    private function file(array $validated): CaseFile
    {
        $narrative = $validated['incident_narrative'] ?? null;

        /* Taken off the case's own columns: it is its own record. */
        $order = ($validated['protection_needed'] ?? null) === 'Yes'
            ? ($validated['protection_order'] ?? null)
            : null;
        unset($validated['protection_order']);

        /*
         * She reported it herself: then nobody else's name, number or consent
         * belongs on the case, whatever the form still held from a moment
         * when another answer was chosen.
         */
        if (($validated['reported_by_type'] ?? null) === 'Victim-Survivor') {
            foreach (['reported_by_name', 'reported_by_resident_id', 'reported_by_relationship',
                'reported_by_contact', 'applicant_consent'] as $field) {
                $validated[$field] = null;
            }
        }

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
            'approximate_time' => isset($validated['approximate_time']) && trim($validated['approximate_time']) !== ''
                ? trim($validated['approximate_time'])
                : null,
            'location' => $validated['incident_location'] ?? null,
            'is_ongoing' => $validated['is_ongoing'] ?? null,
            'offender_nearby' => $validated['offender_nearby'] ?? null,
        ];

        unset(
            $validated['incident_narrative'],
            $validated['occurred_at'],
            $validated['approximate_time'],
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

        /*
         * Nothing to reconcile for the respondent: it is a register id and
         * only ever was. Their name, address, number and birth date stay in
         * the register, so a protection order drawn six weeks later is served
         * on where they live THEN, not on a copy taken at the counter today.
         */
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

        /* In danger right now: Critical, whatever else was said. */
        if ($level = CaseFile::riskFromDanger($validated['currently_in_danger'] ?? null)) {
            $validated['risk_level'] = $level;
        }

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

        /*
         * Immediate protection needed: the order is on the case from the
         * first minute, at whatever stage it is — even "Not Yet Applied" —
         * so the desk sees a need nobody has acted on yet.
         */
        if ($order) {
            $bpo = $case->protectionOrders()->create(ProtectionOrderForm::attributes($order) + [
                'recorded_by' => auth()->id(),
            ]);

            AccessLog::record($case->id, 'bpo_recorded', 'BPO: ' . $bpo->status);
        }

        return $case;
    }
}
