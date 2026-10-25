<?php

namespace Database\Seeders;

use App\Models\Lupon\CaseFile;
use App\Models\Lupon\Hearing;
use App\Models\Resident\Resident;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LuponCfaTestCasesSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure non-resident respondent exists for Case #3
        $nonResidentRespondent = Resident::firstOrCreate(
            ['resident_number' => 'NR-2026-0001'],
            [
                'record_type' => Resident::NON_RESIDENT,
                'first_name' => 'Mario',
                'middle_name' => 'Santos',
                'last_name' => 'Villanueva',
                'gender' => 'Male',
                'birthdate' => '1985-06-15',
                'birth_place' => 'Tagoloan, Misamis Oriental',
                'nationality' => 'Filipino',
                'civil_status' => 'Married',
                'address' => 'Poblacion, Tagoloan, Misamis Oriental',
                'contact_number' => '+639178889900',
                'is_active' => true,
            ]
        );

        // Fetch verified resident records
        $resident1 = Resident::find(1); // Chuchielee Aca
        $resident2 = Resident::find(2); // Rolly Jane Agiobo
        $resident3 = Resident::find(3); // Rolly Jay Agiobo
        $resident4 = Resident::find(4); // Jewel Agiobo
        $resident6 = Resident::find(6); // Ernieto Roselim
        $resident8 = Resident::find(8); // Elson Roselim
        $resident10 = Resident::find(10); // Dominic Madera

        $casesData = [
            [
                'case_number' => '2026-08-10-01',
                'nature' => 'Land Dispute',
                'title' => 'Boundary encroachment on agricultural land',
                'complainant_id' => $resident1?->id ?? 1,
                'complainant_name' => null,
                'complainant_address' => null,
                'complainant_contact' => null,
                'respondent_id' => $resident2?->id ?? 2,
                'narrative' => 'Complainant alleges that respondent extended concrete fence 2 meters beyond property boundary line into complainant agricultural land.',
                'slot_start' => '08:00:00',
                'slot_end' => '09:00:00',
            ],
            [
                'case_number' => '2026-08-10-02',
                'nature' => 'Debt',
                'title' => 'Unpaid personal loan of PHP 45,000',
                'complainant_id' => null,
                'complainant_name' => 'Rodrigo B. Mendoza',
                'complainant_address' => 'Barangay Casinglot, Tagoloan, Misamis Oriental',
                'complainant_contact' => '+639171112233',
                'respondent_id' => $resident6?->id ?? 6,
                'narrative' => 'Non-resident complainant lent respondent PHP 45,000 payable with promissory note on June 2026. Respondent defaulted on payment.',
                'slot_start' => '09:00:00',
                'slot_end' => '10:00:00',
            ],
            [
                'case_number' => '2026-08-10-03',
                'nature' => 'Property Damage',
                'title' => 'Perimeter fence and crop destruction by cattle',
                'complainant_id' => $resident10?->id ?? 10,
                'complainant_name' => null,
                'complainant_address' => null,
                'complainant_contact' => null,
                'respondent_id' => $nonResidentRespondent->id,
                'narrative' => 'Resident complainant claims respondent livestock strayed into Purok 4 farm lot, destroying corn crops and wooden fence with estimated damage of PHP 18,000.',
                'slot_start' => '10:00:00',
                'slot_end' => '11:00:00',
            ],
            [
                'case_number' => '2026-08-10-04',
                'nature' => 'Family Dispute',
                'title' => 'Dispute over right-of-way and family easement',
                'complainant_id' => $resident3?->id ?? 3,
                'complainant_name' => null,
                'complainant_address' => null,
                'complainant_contact' => null,
                'respondent_id' => $resident4?->id ?? 4,
                'narrative' => 'Siblings disputing the access passage and right-of-way between adjoining inherited residential lots in Purok 1.',
                'slot_start' => '11:00:00',
                'slot_end' => '12:00:00',
            ],
            [
                'case_number' => '2026-08-10-05',
                'nature' => 'Assault',
                'title' => 'Physical altercation and slight physical injury',
                'complainant_id' => null,
                'complainant_name' => 'Teresa G. Cruz',
                'complainant_address' => 'Barangay Sta. Cruz, Tagoloan, Misamis Oriental',
                'complainant_contact' => '+639185556677',
                'respondent_id' => $resident8?->id ?? 8,
                'narrative' => 'Non-resident complainant was verbally assaulted and pushed by respondent during a public gathering at the barangay plaza.',
                'slot_start' => '13:00:00',
                'slot_end' => '14:00:00',
            ],
        ];

        // Tuesdays (Punong Barangay Mediation): 2026-08-18, 2026-08-25, 2026-09-01
        $pbTuesdays = ['2026-08-18', '2026-08-25', '2026-09-01'];

        // Thursdays (Lupon Conciliation): 2026-09-10, 2026-09-17, 2026-09-24
        $luponThursdays = ['2026-09-10', '2026-09-17', '2026-09-24'];

        foreach ($casesData as $item) {
            $case = CaseFile::firstOrNew(['case_number' => $item['case_number']]);

            $case->case_title = $item['title'];
            $case->case_classification = $item['nature'];
            $case->complainant_id = $item['complainant_id'];
            $case->complainant_name = $item['complainant_name'];
            $case->complainant_address = $item['complainant_address'];
            $case->complainant_contact = $item['complainant_contact'];
            $case->jurisdiction_status = 'Accepted';
            $case->current_stage = 'Conciliation';
            $case->payment_status = 'Paid';
            $case->payment_required_at = '2026-08-10 09:00:00';
            $case->payment_due_at = '2026-08-13 17:00:00';
            $case->date_filed = '2026-08-10';
            $case->notes = 'Completed 3 PB mediation hearings and 3 Lupon conciliation hearings without agreement. Eligible for Certificate to File Action (CFA).';
            $case->assigned_lupon_secretary = 6;
            $case->save();

            // Link respondent in pivot table
            DB::table('lupon_case_respondents')->updateOrInsert(
                ['lupon_case_id' => $case->id, 'resident_id' => $item['respondent_id']],
                ['created_at' => now(), 'updated_at' => now()]
            );

            // Record complaint narrative
            DB::table('lupon_complaints')->updateOrInsert(
                ['lupon_case_id' => $case->id],
                [
                    'complaint_narrative' => $item['narrative'],
                    'date_of_occurrence' => '2026-08-08',
                    'place_of_occurrence' => 'Barangay Natumolan, Tagoloan',
                    'residency_verified' => true,
                    'relationship_nature' => 'Neighbor',
                    'has_previous_settlement' => false,
                    'complaint_received_date' => '2026-08-10',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // Record filing payment
            DB::table('lupon_payments')->updateOrInsert(
                ['lupon_case_id' => $case->id, 'kind' => 'Filing'],
                [
                    'status' => 'Paid',
                    'requested_by' => 6,
                    'requested_at' => '2026-08-10 09:15:00',
                    'paid_by' => 3, // Clerk June Cavan
                    'paid_at' => '2026-08-10 10:30:00',
                    'notes' => 'Filing fee paid at barangay counter.',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // 1. Create 3 PB Mediation hearings (Tuesdays)
            foreach ($pbTuesdays as $seq => $tuesdayDate) {
                $schedStart = "{$tuesdayDate} {$item['slot_start']}";
                $schedEnd = "{$tuesdayDate} {$item['slot_end']}";

                $hearing = Hearing::firstOrNew([
                    'lupon_case_id' => $case->id,
                    'hearing_type' => 'Mediation',
                    'scheduled_at' => $schedStart,
                ]);

                $hearing->started_at = $schedStart;
                $hearing->ended_at = $schedEnd;
                $hearing->status = 'Completed';
                $hearing->summons_issued = true;
                $hearing->summons_printed_at = date('Y-m-d H:i:s', strtotime("{$schedStart} - 4 days"));
                $hearing->summons_served_date = date('Y-m-d', strtotime("{$schedStart} - 2 days"));
                $hearing->complainant_present = true;
                $hearing->respondent_present = true;
                $hearing->attendance_notes = 'Complainant and respondent present in person.';
                $hearing->proceedings_notes = ($seq === 2)
                    ? 'Third PB mediation session concluded without settlement. Forwarded to Lupon Tagapamayapa for conciliation.'
                    : "PB Mediation Session #" . ($seq + 1) . " held before Punong Barangay. Parties explored settlement terms but no agreement was reached.";
                $hearing->outcome = ($seq === 2) ? 'Move to Lupon' : 'No Agreement';
                $hearing->recorded_by = 2; // Secretary Grace Galola
                $hearing->save();
            }

            // 2. Create 3 Lupon Conciliation hearings (Thursdays)
            foreach ($luponThursdays as $seq => $thursdayDate) {
                $schedStart = "{$thursdayDate} {$item['slot_start']}";
                $schedEnd = "{$thursdayDate} {$item['slot_end']}";

                $hearing = Hearing::firstOrNew([
                    'lupon_case_id' => $case->id,
                    'hearing_type' => 'Conciliation',
                    'scheduled_at' => $schedStart,
                ]);

                $hearing->started_at = $schedStart;
                $hearing->ended_at = $schedEnd;
                $hearing->status = 'Completed';
                $hearing->summons_issued = true;
                $hearing->summons_printed_at = date('Y-m-d H:i:s', strtotime("{$schedStart} - 4 days"));
                $hearing->summons_served_date = date('Y-m-d', strtotime("{$schedStart} - 2 days"));
                $hearing->complainant_present = true;
                $hearing->respondent_present = true;
                $hearing->attendance_notes = 'Both parties appeared before the Pangkat ng Tagapagkasundo.';
                $hearing->proceedings_notes = ($seq === 2)
                    ? 'Third Lupon conciliation sitting concluded without amicable settlement. All Katarungang Pambarangay conciliation efforts exhausted. Case is now eligible for Certificate to File Action (CFA).'
                    : "Lupon Conciliation Session #" . ($seq + 1) . " held before Pangkat. Proposals discussed, no agreement reached.";
                $hearing->outcome = 'No Agreement';
                $hearing->recorded_by = 6; // Lupon Secretary Faye Ordiz
                $hearing->save();
            }
        }

        $this->command->info('Seeded 5 realistic Lupon CFA test cases successfully.');
    }
}
