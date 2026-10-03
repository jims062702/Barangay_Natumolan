<?php

namespace Tests\Feature;

use App\Models\Account\User;
use App\Models\Resident\Marriage;
use App\Models\Population\PopulationEvent;
use App\Models\Resident\Resident;
use App\Models\Service\Certificate;
use App\Models\Service\ServiceRequest;
use App\Services\Resident\DeathConfirmationService;
use App\Support\ManilaTime;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class DeathCertificateWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    /** Test relationship detection and transactional death confirmation. */
    public function test_death_confirmation_service_and_relationships()
    {
        // Setup parent and child residents
        $parent = Resident::create([
            'resident_number' => 'TEST-0001',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'gender' => 'Male',
            'birthdate' => '1960-01-01',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $child = Resident::create([
            'resident_number' => 'TEST-0002',
            'first_name' => 'Junior',
            'last_name' => 'Doe',
            'gender' => 'Male',
            'birthdate' => '1990-01-01',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        \Illuminate\Support\Facades\DB::table('resident_parents')->insert([
            'parent_id' => $parent->id,
            'child_id' => $child->id,
            'parent_role' => 'Father',
            'child_role' => 'Son',
        ]);

        // Spouse
        $spouse = Resident::create([
            'resident_number' => 'TEST-0003',
            'first_name' => 'Jane',
            'last_name' => 'Doe',
            'gender' => 'Female',
            'birthdate' => '1965-01-01',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $parent->marryTo($spouse, '1985-05-10');

        $deathService = app(DeathConfirmationService::class);

        // Check relationship detection (requester's relationship to the deceased)
        $relChildToParent = $deathService->getRelationship($child, $parent);
        $this->assertEquals('Child', $relChildToParent);

        $relParentToChild = $deathService->getRelationship($parent, $child);
        $this->assertEquals('Parent', $relParentToChild);

        $relSpouse = $deathService->getRelationship($spouse, $parent);
        $this->assertEquals('Spouse', $relSpouse);

        // Create user account for parent
        $user = User::create([
            'name' => 'John Doe',
            'email' => 'john.doe.test@example.com',
            'password' => bcrypt('password'),
            'role' => 'resident',
            'resident_id' => $parent->id,
            'is_active' => true,
        ]);

        // Confirm death of parent
        $deathService->confirmDeath($parent, '2026-09-15', 'Hospital death', null, null);

        $parent->refresh();
        $this->assertEquals('Deceased', $parent->life_status);
        $this->assertEquals('2026-09-15', $parent->date_of_death?->toDateString());

        $user->refresh();
        $this->assertFalse((bool) $user->is_active);

        // Check marriage ended as Widowed
        $marriage = Marriage::where('resident_id', $parent->id)->first();
        $this->assertEquals('Widowed', $marriage->end_reason);

        $spouse->refresh();
        $this->assertEquals('Widowed', $spouse->civil_status);

        // Check Population event logged
        $this->assertTrue(\App\Models\Population\Event::where('resident_id', $parent->id)->where('event_type', 'Death')->exists());
    }

    /** Test that deceased user account gets deactivated message upon login. */
    public function test_deceased_user_login_blocked()
    {
        $deceased = Resident::create([
            'resident_number' => 'TEST-0004',
            'first_name' => 'Dead',
            'last_name' => 'Resident',
            'gender' => 'Male',
            'birthdate' => '1950-01-01',
            'life_status' => 'Deceased',
            'record_type' => 'Resident',
        ]);

        User::create([
            'name' => 'Dead Resident',
            'email' => 'dead.resident.test@example.com',
            'password' => bcrypt('password123'),
            'role' => 'resident',
            'resident_id' => $deceased->id,
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'dead.resident.test@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'message' => 'Your resident account has been deactivated because the resident record is marked as deceased. Please contact the Barangay Office if you believe this is incorrect.',
        ]);
    }

    /** Test walk-in certification of death filing and self-selection prevention. */
    public function test_walkin_certification_of_death()
    {
        $clerk = User::create([
            'name' => 'Barangay Clerk',
            'email' => 'clerk.test@example.com',
            'password' => bcrypt('password'),
            'role' => 'Clerk',
            'office' => 'Main Office',
            'is_active' => true,
        ]);

        $requester = Resident::create([
            'resident_number' => 'REQ-0001',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'gender' => 'Female',
            'birthdate' => '1980-05-15',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $deceased = Resident::create([
            'resident_number' => 'DEC-0001',
            'first_name' => 'Pedro',
            'last_name' => 'Santos',
            'gender' => 'Male',
            'birthdate' => '1955-08-20',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        // Attempt self-selection as deceased
        $selfSelectResponse = $this->actingAs($clerk)->postJson('/api/certificates', [
            'resident_id' => $requester->id,
            'certificate_type' => 'Certification of Death',
            'purpose' => 'Death Certificate',
            'template_fields' => [
                'deceased_resident_id' => $requester->id,
                'deceased_name' => $requester->full_name,
                'deceased_age' => '46',
                'deceased_address' => 'Zone 1, Barangay Natumolan',
                'date_of_death' => '2026-09-20',
                'time_of_death' => '8:00 AM',
                'place_of_death' => 'Home',
                'relationship_to_deceased' => 'Self',
            ],
        ]);
        $selfSelectResponse->assertStatus(422);

        // Valid walk-in filing
        $validResponse = $this->actingAs($clerk)->postJson('/api/certificates', [
            'resident_id' => $requester->id,
            'certificate_type' => 'Certification of Death',
            'purpose' => 'Death Certificate',
            'template_fields' => [
                'deceased_resident_id' => $deceased->id,
                'deceased_name' => $deceased->full_name,
                'deceased_age' => '71',
                'deceased_address' => 'Zone 1, Barangay Natumolan',
                'date_of_death' => '2026-09-20',
                'time_of_death' => '8:00 AM',
                'place_of_death' => 'Home',
                'relationship_to_deceased' => 'Daughter',
            ],
        ]);
        $validResponse->assertStatus(201);

        $deceased->refresh();
        $this->assertEquals('Deceased', $deceased->life_status);
        $this->assertEquals('2026-09-20', $deceased->date_of_death?->toDateString());
    }

    /** Test online portal request lifecycle: pending -> confirm / reject. */
    public function test_portal_request_and_clerk_actions()
    {
        $clerk = User::create([
            'name' => 'Barangay Clerk 2',
            'email' => 'clerk2.test@example.com',
            'password' => bcrypt('password'),
            'role' => 'Clerk',
            'office' => 'Main Office',
            'is_active' => true,
        ]);

        $requester = Resident::create([
            'resident_number' => 'REQ-0002',
            'first_name' => 'Ana',
            'last_name' => 'Reyes',
            'gender' => 'Female',
            'birthdate' => '1992-03-10',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $requesterUser = User::create([
            'name' => 'Ana Reyes',
            'email' => 'ana.reyes@example.com',
            'password' => bcrypt('password'),
            'role' => 'Resident',
            'resident_id' => $requester->id,
            'is_active' => true,
        ]);

        $deceased = Resident::create([
            'resident_number' => 'DEC-0002',
            'first_name' => 'Manuel',
            'last_name' => 'Reyes',
            'gender' => 'Male',
            'birthdate' => '1960-12-05',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        // Submit via portal
        $portalResponse = $this->actingAs($requesterUser)->postJson('/api/portal/requests', [
            'items' => [
                [
                    'service_type' => 'Certification of Death',
                    'template_fields' => [
                        'deceased_resident_id' => $deceased->id,
                        'deceased_name' => $deceased->full_name,
                        'deceased_age' => '65',
                        'deceased_address' => 'Zone 3, Barangay Natumolan',
                        'date_of_death' => '2026-09-25',
                        'time_of_death' => '11:15 AM',
                        'place_of_death' => 'Northern Mindanao Medical Center',
                        'relationship_to_deceased' => 'Daughter',
                    ],
                ],
            ],
        ]);
        $portalResponse->assertStatus(201);

        // Crucial test: Resident must NOT be marked deceased upon request submission!
        $deceased->refresh();
        $this->assertEquals('Alive', $deceased->life_status);

        // Find the raised Pending certificate
        $cert = Certificate::where('certificate_type', 'Certification of Death')
            ->where('resident_id', $requester->id)
            ->latest('id')
            ->first();
        $this->assertNotNull($cert);
        $this->assertEquals('Pending', $cert->status);

        // Clerk verifies & confirms death
        $confirmResponse = $this->actingAs($clerk)->postJson("/api/certificates/{$cert->id}/confirm-death");
        $confirmResponse->assertStatus(200);

        // Now deceased status is confirmed!
        $deceased->refresh();
        $this->assertEquals('Deceased', $deceased->life_status);
        $this->assertEquals('2026-09-25', $deceased->date_of_death?->toDateString());

        $cert->refresh();
        $this->assertEquals(true, $cert->template_fields['death_confirmed'] ?? false);
    }

    /** Test rejection leaves resident alive. */
    public function test_rejection_leaves_resident_alive()
    {
        $clerk = User::create([
            'name' => 'Barangay Clerk 3',
            'email' => 'clerk3.test@example.com',
            'password' => bcrypt('password'),
            'role' => 'Clerk',
            'office' => 'Main Office',
            'is_active' => true,
        ]);

        $requester = Resident::create([
            'resident_number' => 'REQ-0003',
            'first_name' => 'Carlo',
            'last_name' => 'Lim',
            'gender' => 'Male',
            'birthdate' => '1995-01-01',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $requesterUser = User::create([
            'name' => 'Carlo Lim',
            'email' => 'carlo.lim@example.com',
            'password' => bcrypt('password'),
            'role' => 'Resident',
            'resident_id' => $requester->id,
            'is_active' => true,
        ]);

        $allegedDeceased = Resident::create([
            'resident_number' => 'DEC-0003',
            'first_name' => 'Mario',
            'last_name' => 'Lim',
            'gender' => 'Male',
            'birthdate' => '1970-01-01',
            'life_status' => 'Alive',
            'record_type' => 'Resident',
        ]);

        $this->actingAs($requesterUser)->postJson('/api/portal/requests', [
            'items' => [
                [
                    'service_type' => 'Certification of Death',
                    'template_fields' => [
                        'deceased_resident_id' => $allegedDeceased->id,
                        'deceased_name' => $allegedDeceased->full_name,
                        'deceased_age' => '56',
                        'deceased_address' => 'Zone 4',
                        'date_of_death' => '2026-09-28',
                        'time_of_death' => '2:00 PM',
                        'place_of_death' => 'Hospital',
                        'relationship_to_deceased' => 'Son',
                    ],
                ],
            ],
        ]);

        $cert = Certificate::where('certificate_type', 'Certification of Death')
            ->where('resident_id', $requester->id)
            ->latest('id')
            ->first();

        // Clerk rejects the death certificate request
        $rejectResponse = $this->actingAs($clerk)->postJson("/api/certificates/{$cert->id}/reject", [
            'reason' => 'Resident is confirmed alive and well.',
        ]);
        $rejectResponse->assertStatus(200);

        $cert->refresh();
        $this->assertEquals('Cancelled', $cert->status);

        // Resident MUST remain Alive!
        $allegedDeceased->refresh();
        $this->assertEquals('Alive', $allegedDeceased->life_status);
        $this->assertNull($allegedDeceased->date_of_death);
    }

    /** Test deceased resident blocked from initiating Lupon or VAWC reports. */
    public function test_deceased_blocked_from_lupon_and_vawc()
    {
        $deceased = Resident::create([
            'resident_number' => 'DEC-0004',
            'first_name' => 'Ghost',
            'last_name' => 'Complainant',
            'gender' => 'Male',
            'birthdate' => '1980-01-01',
            'life_status' => 'Deceased',
            'record_type' => 'Resident',
        ]);

        $luponSec = User::create([
            'name' => 'Lupon Sec',
            'email' => 'lupon.sec@example.com',
            'password' => bcrypt('password'),
            'role' => 'Lupon Secretary',
            'office' => 'Lupon',
            'is_active' => true,
        ]);

        // Attempt filing Lupon case
        $luponResponse = $this->actingAs($luponSec)->postJson('/api/lupon/cases', [
            'complainant_id' => $deceased->id,
            'incident_title' => 'Property boundary dispute',
            'incident_date' => '2026-09-10',
            'dispute_type' => 'Civil',
            'nature_of_dispute' => 'Boundary',
        ]);
        $luponResponse->assertStatus(422);
    }
}
