<?php

namespace App\Services\Vawc;

use App\Models\Account\User;
use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Models\Vawc\AccessLog;
use App\Models\Vawc\CaseFile;
use App\Models\Vawc\OnlineReport;
use App\Services\Resident\ResidentCards;
use App\Support\DateWindow;
use App\Support\ManilaTime;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * VAWC ONLINE COMPLAINTS — residents only, and verified before they are cases.
 *
 * WHO MAY SEND ONE: a WOMAN who is a resident of Barangay Natumolan (the
 * office's rule, 2026-09-30), identified by her Barangay Resident ID — checked
 * against the register by ResidentCards, and her record's sex by
 * VawcComplainant. There is no other way in: no "I live elsewhere", no guest
 * complaint, and a man's Resident ID is refused.
 *
 * WHO IT IS ABOUT: she writes the respondent's name and where they live — the
 * register is not searched from here (2026-09-30). The VAW Desk finds them on
 * the register when it verifies the complaint, as the Lupon does with its own
 * online complaints: a barangay protection order can only be issued against
 * one of the barangay's own, so the case is opened with a registered resident
 * as its respondent, chosen by the desk. A respondent may be a man or a woman.
 *
 * All of it is checked HERE, on the server, whatever the page did.
 *
 * WHEN IT IS VERIFIED — the office's rule (2026-09-28), like the Lupon's:
 *
 *   no threat reported   she comes to the VAW Desk to confirm it, and only
 *                        then is it verified. The desk cannot accept it
 *                        without "confirmed in person".
 *   a threat reported    (or danger right now) coming in first is OPTIONAL.
 *                        The desk may verify it and act without waiting for
 *                        a visit that may not be safe for her to make.
 *
 * Verified, it becomes an ordinary VAWC case (CaseFile) — the survivor is
 * the resident who reported, the respondent is the one the desk chose, what
 * she wrote is its first incident — and the desk completes it from there.
 */
final class OnlineReports
{
    /** Where the Resident ID picture goes: the private disk, never the public one. */
    public const ID_DIR = 'vawc/online-reports/ids';
    public const EVIDENCE_DIR = 'vawc/online-reports/evidence';

    /**
     * Who the desk may open the case against: a registered, living, current
     * resident of this barangay — and not the complainant herself.
     *
     * @return array{0: ?Resident, 1: ?string} the respondent, or why not
     */
    public static function respondentFor($id, Resident $complainant): array
    {
        $respondent = is_numeric($id) ? Resident::find((int) $id) : null;

        if (! $respondent || ! ResidentCards::eligible($respondent)) {
            return [null, 'Choose the respondent from the register — a registered resident of Barangay Natumolan. '
                . 'A barangay protection order can only be issued against one of the barangay\'s own; if the person '
                . 'is not on the register, take the case as a walk-in or refer it to the police Women and Children '
                . 'Protection Desk.'];
        }

        if ($respondent->id === $complainant->id) {
            return [null, 'The respondent cannot be the complainant herself. Choose the person the complaint is about.'];
        }

        return [$respondent, null];
    }

    public function file(array $data, Resident $resident, ResidentCard $card, string $via, UploadedFile $id, array $evidence = []): OnlineReport
    {
        return DB::transaction(function () use ($data, $resident, $card, $via, $id, $evidence) {
            $threatened = (bool) $data['threatened'];
            $danger = (bool) $data['in_danger_now'];

            $evidencePaths = [];
            foreach ($evidence as $file) {
                if ($file instanceof UploadedFile) {
                    $evidencePaths[] = $file->store(self::EVIDENCE_DIR, 'local');
                }
            }

            $report = OnlineReport::create([
                'reference_no' => OnlineReport::nextReference((int) substr(ManilaTime::today(), 0, 4)),
                'resident_id' => $resident->id,
                'resident_card_id' => $card->id,
                'filed_via' => $via,
                'violence_types' => array_values($data['violence_types']),
                'narrative' => $data['narrative'],
                'occurred_on' => $data['occurred_on'] ?? null,
                'place' => $data['place'] ?? null,
                /* As she wrote it. The desk finds them on the register when it verifies. */
                'respondent_name' => $data['respondent_name'],
                'respondent_address' => $data['respondent_address'] ?? null,
                'relationship' => $data['relationship'] ?? null,
                'threatened' => $threatened,
                'in_danger_now' => $danger,
                'safe_contact' => $data['safe_contact'] ?? null,
                'safe_time' => $data['safe_time'] ?? null,
                'id_path' => $id->store(self::ID_DIR, 'local'),
                'evidence_paths' => $evidencePaths,
                'status' => OnlineReport::FOR_VERIFICATION,
                /* No threat: she confirms it in person first. A threat: optional. */
                'visit_required' => ! ($threatened || $danger),
            ]);

            /* The VAW Desk is told — the reference and nothing more. A notice
               that fails does not lose the complaint. */
            try {
                OnlineReportNotice::toDesk($report);
            } catch (\Throwable $failure) {
                report($failure);
            }

            return $report;
        });
    }

    /** What happens next, in the words she is told — on the page and on her portal. */
    public static function nextStep(OnlineReport $report): string
    {
        return match ($report->status) {
            OnlineReport::ACCEPTED => 'Verified by the VAW Desk. The desk is handling your case — you may visit the VAW Desk at any time.',
            OnlineReport::DECLINED => 'Not accepted by the VAW Desk' . ($report->office_note ? ': ' . $report->office_note : '.')
                . ' You may still visit the VAW Desk in person.',
            default => $report->visit_required
                ? 'Please visit the Barangay VAW Desk (Monday to Friday, 8:00 AM to 5:00 PM) with your Barangay Resident ID to confirm your report. It is verified there.'
                : 'Because you told us you have been threatened, you do not have to come in before the VAW Desk acts on your report. You may still visit the desk at any time. If you are in danger now, call 911.',
        };
    }

    /**
     * Verified — and opened as a VAWC case.
     *
     * @throws RuntimeException when it may not be verified yet
     */
    public function accept(OnlineReport $report, bool $confirmedInPerson, ?string $note, User $by, Resident $respondent): CaseFile
    {
        if ($report->status !== OnlineReport::FOR_VERIFICATION) {
            throw new RuntimeException('This report is already ' . strtolower($report->status) . '.');
        }

        /* A complaint sent before the rule, by somebody whose record is not a woman's. */
        if ($report->resident && ($refusal = VawcComplainant::deskRefusal($report->resident))) {
            throw new RuntimeException($refusal . ' Decline this complaint, or correct the record first.');
        }

        if ($report->visit_required && ! $confirmedInPerson) {
            throw new RuntimeException('No threat was reported, so this report is verified only after the resident '
                . 'has confirmed it in person at the VAW Desk. Tick "Confirmed in person" once she has.');
        }

        return DB::transaction(function () use ($report, $confirmedInPerson, $note, $by, $respondent) {
            $notes = array_filter([
                'Reported online as ' . $report->reference_no . ' (' . $report->filed_via . ').',
                $report->respondent_name ? 'Respondent as she wrote it: ' . $report->respondent_name
                    . ($report->respondent_address ? ', ' . $report->respondent_address : '') . '.' : null,
                $report->safe_contact ? 'Safe way to reach her: ' . $report->safe_contact
                    . ($report->safe_time ? ' (' . $report->safe_time . ')' : '') . '.' : null,
                $report->threatened ? 'She reported being threatened.' : null,
                $note ? 'Desk note: ' . $note : null,
            ]);

            $case = CaseFile::create([
                'case_code' => CaseFile::nextCaseCode(),
                'survivor_id' => $report->resident_id,
                /* The registered resident the desk chose when verifying it. */
                'respondent_id' => $respondent->id,
                'reported_by_type' => 'Victim-Survivor',
                'reporting_channel' => 'Online report',
                'violence_types' => $report->violence_types,
                'relationship_to_offender' => $report->relationship && $report->relationship !== 'Other' ? $report->relationship : null,
                'currently_in_danger' => $report->in_danger_now ? 'Yes' : 'No',
                'risk_level' => CaseFile::riskFromDanger($report->in_danger_now ? 'Yes' : 'No'),
                'risk_assessed_at' => $report->in_danger_now ? now() : null,
                'children_involved' => false,
                'children_count' => 0,
                'previous_incidents_count' => 0,
                'assigned_vawc_officer' => $by->id,
                'status' => 'Active',
                'confidential_notes' => implode("\n", $notes),
                /* When she reported it — not when the desk got to it. */
                'report_date' => $report->created_at,
            ]);

            $case->incidents()->create([
                /* A day, not a moment: the start of it, in Manila. */
                'occurred_at' => $report->occurred_on ? DateWindow::manilaToUtc($report->occurred_on->toDateString()) : null,
                'location' => $report->place,
                'incident_narrative' => $report->narrative,
                'is_confidential' => true,
            ]);

            AccessLog::record($case->id, 'created', 'Case opened from online report ' . $report->reference_no);

            /* Attach complainant's Resident ID as a case document */
            if ($report->id_path) {
                $case->documents()->create([
                    'document_type' => 'Photograph',
                    'title' => 'Complainant Resident ID (' . $report->reference_no . ')',
                    'file_reference' => $report->id_path,
                    'description' => 'Barangay Resident ID uploaded by complainant in online report ' . $report->reference_no,
                    'uploaded_by' => $by->id,
                    'document_date' => $report->created_at?->toDateString(),
                ]);
            }

            /* Attach complainant's evidence files as case documents */
            if (! empty($report->evidence_paths) && is_array($report->evidence_paths)) {
                foreach ($report->evidence_paths as $idx => $path) {
                    $case->documents()->create([
                        'document_type' => 'Photograph',
                        'title' => 'Online Evidence #' . ($idx + 1) . ' (' . $report->reference_no . ')',
                        'file_reference' => $path,
                        'description' => 'Evidence uploaded by complainant in online report ' . $report->reference_no,
                        'uploaded_by' => $by->id,
                        'document_date' => $report->created_at?->toDateString(),
                    ]);
                }
            }

            $report->update([
                'status' => OnlineReport::ACCEPTED,
                'respondent_id' => $respondent->id,
                'confirmed_in_person' => $confirmedInPerson,
                'vawc_case_id' => $case->id,
                'reviewed_by' => $by->id,
                'reviewed_at' => now(),
            ]);
            $report->logView('accepted');

            return $case;
        });
    }

    public function decline(OnlineReport $report, string $reason, User $by): void
    {
        if ($report->status !== OnlineReport::FOR_VERIFICATION) {
            throw new RuntimeException('This report is already ' . strtolower($report->status) . '.');
        }

        $report->update([
            'status' => OnlineReport::DECLINED,
            'office_note' => $reason,
            'reviewed_by' => $by->id,
            'reviewed_at' => now(),
        ]);
        $report->logView('declined');
    }
}
