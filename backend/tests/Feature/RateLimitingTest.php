<?php

namespace Tests\Feature;

use App\Models\Population\Zone;
use App\Models\Resident\Resident;
use App\Models\Resident\ResidentCard;
use App\Services\Resident\ResidentCards;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class RateLimitingTest extends TestCase
{
    use DatabaseTransactions;

    public function test_multiple_certificate_requests_do_not_hit_rate_limit(): void
    {
        $zone = Zone::firstOrCreate([
            'name' => 'Zone 1',
        ], [
            'is_active' => true,
        ]);

        $cardsService = app(ResidentCards::class);

        // Make 5 consecutive requests with different residents
        for ($i = 1; $i <= 5; $i++) {
            $resident = Resident::create([
                'resident_number' => "RES-RATE-00{$i}",
                'first_name' => "Resident{$i}",
                'last_name' => 'Testing',
                'birthdate' => '1995-01-01',
                'sex' => 'Male',
                'civil_status' => 'Single',
                'zone_purok' => 'Zone 1',
                'life_status' => 'Living',
                'record_type' => 'Resident',
            ]);

            $card = $cardsService->issue($resident, ResidentCard::VIA_OFFICE);

            // 1. Verify resident ID
            $verifyResponse = $this->postJson('/api/resident-id/verify', [
                'code' => $card->token,
            ]);
            $verifyResponse->assertStatus(200);

            // 2. Check certificate request needs
            $checkResponse = $this->postJson('/api/certificate-request/check', [
                'resident_card_code' => $card->token,
                'service_type' => 'Barangay Clearance',
            ]);
            $checkResponse->assertStatus(200);

            // 3. Submit certificate request
            $submitResponse = $this->postJson('/api/certificate-request', [
                'resident_card_code' => $card->token,
                'service_type' => 'Barangay Clearance',
                'purpose' => 'Employment requirement',
            ]);

            $submitResponse->assertStatus(201);
            $this->assertNotEquals(429, $submitResponse->status(), "Resident $i should not hit rate limit");
        }
    }

    public function test_route_throttle_prefixes_are_isolated(): void
    {
        $zone = Zone::firstOrCreate([
            'name' => 'Zone 1',
        ], [
            'is_active' => true,
        ]);

        $cardsService = app(ResidentCards::class);

        $resident = Resident::create([
            'resident_number' => 'RES-ISOLATE-01',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'birthdate' => '1990-05-15',
            'sex' => 'Female',
            'civil_status' => 'Single',
            'zone_purok' => 'Zone 1',
            'life_status' => 'Living',
            'record_type' => 'Resident',
        ]);

        $card = $cardsService->issue($resident, ResidentCard::VIA_OFFICE);

        // Even with repeated ID verification checks, certificate-request remains fresh and separate
        for ($k = 0; $k < 15; $k++) {
            $this->postJson('/api/resident-id/verify', ['code' => $card->token])->assertStatus(200);
        }

        // Submitting certificate-request works smoothly without being polluted by verify attempts
        $submit = $this->postJson('/api/certificate-request', [
            'resident_card_code' => $card->token,
            'service_type' => 'Certificate of Indigency',
            'purpose' => 'Medical assistance',
        ]);

        $submit->assertStatus(201);
        $this->assertNotEquals(429, $submit->status());
    }
}

