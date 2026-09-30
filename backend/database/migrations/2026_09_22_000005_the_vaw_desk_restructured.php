<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The VAW Desk, rebuilt around what the desk actually does.
 *
 *   Intake       who reported it (not a checkbox), the approximate time,
 *                a brief description, and an immediate safety assessment
 *   BPO          its own record: applied, issued by whom, in effect fifteen
 *                days, renewable — every issuance kept
 *   Referral     destination, reason, urgency, status
 *   Follow-up    method, the current safety status, the protection order's
 *                status, new incident, next action
 *   Documents    the desk's own document types, dated
 *   Assessment   the case assessment and action plan, one per case
 *   Dialogue     the ONE dialogue a case may have — the old "session and
 *                agreement" table, with an outcome instead of two
 *                acknowledgment ticks
 *   Children     child and dependent welfare, and support, kept apart from
 *                any agreement between the parties
 *
 * The two cases already on the register keep everything: their relationship
 * is carried to the new words, and nothing encrypted is read or rewritten.
 * Referrals, follow-ups, documents and agreements hold no rows yet, so their
 * lists can change shape without translating anything.
 */
return new class extends Migration
{
    /** The relationship of the victim-survivor to the respondent, old words to new. */
    private const RELATIONSHIPS = [
        'Wife' => 'Spouse',
        'Former Wife' => 'Former Spouse',
        'Live-in Relationship' => 'Cohabiting Partner',
        'Dating Relationship' => 'Dating Partner',
        'Sexual Relationship' => 'Sexual Partner',
    ];

    public function up(): void
    {
        /* ---------------- the case ---------------- */
        Schema::table('vawc_cases', function (Blueprint $table) {
            /* Victim-Survivor, Parent/Guardian, Relative, … — who reported it. */
            $table->string('reported_by_type', 40)->nullable()->after('survivor_id');
            /* The immediate safety assessment. */
            $table->enum('currently_in_danger', ['Yes', 'No', 'Unknown'])->nullable()->after('risk_assessed_at');
            $table->enum('protection_needed', ['Yes', 'No'])->nullable()->after('currently_in_danger');
        });

        /* Nobody else was recorded as reporting either case: the survivor did. */
        DB::table('vawc_cases')->whereNull('reported_by_name')->update(['reported_by_type' => 'Victim-Survivor']);
        DB::table('vawc_cases')->whereNotNull('reported_by_name')->whereNull('reported_by_type')->update(['reported_by_type' => 'Other']);

        foreach (self::RELATIONSHIPS as $old => $new) {
            DB::table('vawc_cases')->where('relationship_to_offender', $old)->update(['relationship_to_offender' => $new]);
        }

        /* ---------------- the incident ---------------- */
        Schema::table('vawc_incidents', function (Blueprint $table) {
            /* "Around 8:00 PM" — a victim may not know the exact time. */
            $table->string('approximate_time', 60)->nullable()->after('occurred_at');
        });

        /* ---------------- protection orders ---------------- */
        Schema::create('vawc_protection_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vawc_case_id')->constrained('vawc_cases')->cascadeOnDelete();
            /* The order this one renews, when it is a renewal. */
            $table->foreignId('renewal_of_id')->nullable()->constrained('vawc_protection_orders')->nullOnDelete();
            $table->enum('status', [
                'Not Yet Applied', 'Application Prepared', 'Applied', 'Issued', 'Not Issued', 'Referred for TPO/PPO',
            ])->default('Not Yet Applied');
            $table->date('applied_on')->nullable();
            $table->date('issued_on')->nullable();
            /* The last day it is in effect — fifteen days, counted from issuance. */
            $table->date('expires_on')->nullable();
            $table->enum('issued_by', ['Punong Barangay', 'Barangay Kagawad'])->nullable();
            $table->string('issued_by_name', 150)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        /* ---------------- referrals ---------------- */
        Schema::table('vawc_referrals', function (Blueprint $table) {
            $table->string('referral_agency', 80)->change();
            $table->text('services_requested')->nullable()->change();
            $table->string('referral_reason', 80)->nullable()->after('referral_agency');
            $table->string('reason_other', 150)->nullable()->after('referral_reason');
            $table->enum('urgency', ['Immediate', 'Within 24 hours', 'Routine'])->default('Routine')->after('reason_other');
            $table->enum('referral_status', [
                'Pending', 'Accepted', 'In Progress', 'Completed', 'Unable to Reach', 'Declined by Client',
            ])->default('Pending')->after('urgency');
            $table->foreignId('referred_by')->nullable()->after('referral_status')->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable()->after('referred_by');
        });

        /* ---------------- follow-ups ---------------- */
        Schema::table('vawc_followups', function (Blueprint $table) {
            $table->string('followup_type', 40)->change();
            $table->string('safety_status', 40)->change();
            $table->dropColumn('bpo_compliance');
        });
        Schema::table('vawc_followups', function (Blueprint $table) {
            $table->string('protection_order_status', 40)->default('No BPO')->after('safety_status');
            $table->string('conducted_by', 150)->nullable()->after('followup_type');
            $table->boolean('new_incident')->nullable()->after('services_received');
            $table->text('additional_needs')->nullable()->after('new_incident');
            $table->text('next_action')->nullable()->after('additional_needs');
        });

        /* ---------------- documents ---------------- */
        Schema::table('vawc_documents', function (Blueprint $table) {
            $table->string('document_type', 60)->change();
            $table->date('document_date')->nullable()->after('document_type');
        });

        /* ---------------- the one dialogue ---------------- */
        Schema::table('vawc_agreements', function (Blueprint $table) {
            $table->enum('outcome', ['Agreement reached', 'No agreement'])->nullable()->after('agreement');
            $table->dropColumn(['survivor_acknowledged', 'respondent_acknowledged']);
        });

        /* ---------------- case assessment & action plan ---------------- */
        Schema::create('vawc_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vawc_case_id')->unique()->constrained('vawc_cases')->cascadeOnDelete();
            $table->date('assessment_date');
            $table->json('persons_present')->nullable();
            $table->text('statement')->nullable();
            $table->text('observations')->nullable();
            $table->json('services_provided')->nullable();
            $table->text('action_plan')->nullable();
            $table->date('next_followup_date')->nullable();
            /* What the victim-survivor was told and offered. */
            $table->boolean('informed_of_rights')->default(false);
            $table->boolean('protection_order_offered')->default(false);
            $table->boolean('referral_made')->default(false);
            $table->boolean('next_steps_documented')->default(false);
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        /* ---------------- child & dependent welfare ---------------- */
        Schema::create('vawc_child_welfare', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vawc_case_id')->unique()->constrained('vawc_cases')->cascadeOnDelete();
            /* Per child: relationship, caregiver, living arrangement, needs. Encrypted. */
            $table->text('children')->nullable();
            $table->enum('support_needed', ['Yes', 'No', 'Unknown'])->nullable();
            $table->json('support_types')->nullable();
            $table->enum('current_support', ['Regular', 'Irregular', 'None', 'Unknown'])->nullable();
            $table->json('referral_needed')->nullable();
            $table->string('referral_other', 150)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vawc_child_welfare');
        Schema::dropIfExists('vawc_assessments');

        Schema::table('vawc_agreements', function (Blueprint $table) {
            $table->dropColumn('outcome');
            $table->boolean('survivor_acknowledged')->default(false);
            $table->boolean('respondent_acknowledged')->default(false);
        });

        Schema::table('vawc_documents', function (Blueprint $table) {
            $table->dropColumn('document_date');
        });

        Schema::table('vawc_followups', function (Blueprint $table) {
            $table->dropColumn(['protection_order_status', 'conducted_by', 'new_incident', 'additional_needs', 'next_action']);
            $table->string('bpo_compliance', 40)->default('No BPO');
        });

        Schema::table('vawc_referrals', function (Blueprint $table) {
            $table->dropConstrainedForeignId('referred_by');
            $table->dropColumn(['referral_reason', 'reason_other', 'urgency', 'referral_status', 'notes']);
        });

        Schema::dropIfExists('vawc_protection_orders');

        Schema::table('vawc_incidents', function (Blueprint $table) {
            $table->dropColumn('approximate_time');
        });

        foreach (self::RELATIONSHIPS as $old => $new) {
            DB::table('vawc_cases')->where('relationship_to_offender', $new)->update(['relationship_to_offender' => $old]);
        }

        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->dropColumn(['reported_by_type', 'currently_in_danger', 'protection_needed']);
        });
    }
};
