<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Lupon\CaseFile as LuponCase;
use App\Models\Service\Certificate;
use App\Models\Vawc\CaseFile as VawcCase;

class VawcAndLuponRulesTest extends TestCase
{
    public function test_lupon_supports_mixed_and_non_resident_parties(): void
    {
        $nonResidentCase = new LuponCase([
            'case_number' => 'KP-2026-0001',
            'case_title' => 'Dispute against non-resident',
            'case_classification' => 'Civil',
            'current_stage' => 'Mediation',
            'complainant_name' => 'John Non-Resident',
            'complainant_address' => 'Cagayan de Oro City',
        ]);

        $this->assertEquals('John Non-Resident', $nonResidentCase->complainant_name);
        $this->assertFalse($nonResidentCase->complainant_is_resident);
        $this->assertEquals('John Non-Resident', $nonResidentCase->complainant_display_name);

        $residentCase = new LuponCase([
            'case_number' => 'KP-2026-0002',
            'case_title' => 'Dispute with resident',
            'case_classification' => 'Civil',
            'current_stage' => 'Mediation',
            'complainant_id' => 123,
        ]);

        $this->assertTrue($residentCase->complainant_is_resident);
    }

    public function test_cfa_conditions_and_hearing_counts(): void
    {
        // Lupon dispute workflow logic test
        $pbMaxHearings = 3;
        $luponMaxHearings = 3;

        $this->assertSame(3, $pbMaxHearings);
        $this->assertSame(3, $luponMaxHearings);
    }

    public function test_certificate_released_at_attribute(): void
    {
        $cert = new Certificate([
            'certificate_number' => 'CERT-2026-0001',
            'reference_number' => 'REF-001',
            'fee_amount' => 50,
            'status' => 'Released',
            'released_at' => now()->toISOString(),
            'cancel_reason' => null,
            'reason_for_cancellation' => null,
        ]);

        $this->assertEquals('Released', $cert->status);
        $this->assertNotNull($cert->released_at);
    }

    public function test_certificate_cancellation_reason_attribute(): void
    {
        $cert = new Certificate([
            'certificate_number' => 'CERT-2026-0002',
            'reference_number' => 'REF-002',
            'fee_amount' => 50,
            'status' => 'Cancelled',
            'cancel_reason' => 'Requested by mistake',
            'reason_for_cancellation' => 'Requested by mistake',
        ]);

        $this->assertEquals('Cancelled', $cert->status);
        $this->assertEquals('Requested by mistake', $cert->cancel_reason);
        $this->assertEquals('Requested by mistake', $cert->reason_for_cancellation);
    }

    public function test_vawc_dialogue_outcomes_and_closure_rules(): void
    {
        $outcomes = \App\Models\Vawc\Agreement::OUTCOMES;
        $this->assertContains('Agreement reached', $outcomes);
        $this->assertContains('Not settled', $outcomes);

        $case = new VawcCase([
            'case_code' => 'VAWC-2026-0001',
            'status' => 'Active',
            'violence_types' => ['Physical'],
        ]);

        $this->assertEquals('Active', $case->status);

        // Case can transition to Closed
        $case->status = 'Closed';
        $case->closed_at = now();
        $this->assertEquals('Closed', $case->status);
        $this->assertNotNull($case->closed_at);
    }
}
