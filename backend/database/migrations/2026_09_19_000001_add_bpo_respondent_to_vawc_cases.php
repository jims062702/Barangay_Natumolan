<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The respondent, and the applicant's authority to file for somebody else.
 *
 * The intake had no respondent AT ALL. Every other party was recorded — the
 * victim, whoever brought the complaint, the children — but the person the
 * complaint is AGAINST existed nowhere in the schema, which means a Barangay
 * Protection Order could not be drawn from this system: item 4 of the
 * Application for Barangay Protection Order asks for their name, birth date,
 * address, telephone, sex, occupation and civil status, and a protection
 * order that does not name who it restrains restrains nobody.
 *
 * Two shapes, as everywhere else that names a person: a register id when the
 * respondent is recorded here, and typed details when they are not. The
 * typed ones are NOT copies of a resident record — they are only ever filled
 * in for somebody the register has never heard of, so there is nothing for
 * them to drift out of step with.
 *
 * `applicant_consent` is item 9: when the applicant is not the victim, on
 * what authority they file. RA 9262 lets a parent, ascendant or relative
 * apply on the victim's behalf, and the circumstance is what shows the
 * application is one of those rather than a stranger's.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->foreignId('respondent_id')->nullable()->after('survivor_id')
                ->constrained('residents')->nullOnDelete();

            /*
             * Encrypted, and therefore text rather than a sized string: a
             * ciphertext is far longer than its plaintext, and a varchar(255)
             * would silently truncate one into something that cannot be
             * decrypted at all.
             */
            $table->text('respondent_name')->nullable()->after('respondent_id');
            $table->text('respondent_address')->nullable()->after('respondent_name');
            $table->text('respondent_contact')->nullable()->after('respondent_address');
            $table->string('respondent_sex', 10)->nullable()->after('respondent_contact');
            $table->date('respondent_birth_date')->nullable()->after('respondent_sex');
            $table->text('respondent_occupation')->nullable()->after('respondent_birth_date');
            $table->string('respondent_civil_status', 30)->nullable()->after('respondent_occupation');

            $table->text('applicant_consent')->nullable()->after('reported_by_contact');
        });
    }

    public function down(): void
    {
        Schema::table('vawc_cases', function (Blueprint $table) {
            $table->dropConstrainedForeignId('respondent_id');
            $table->dropColumn([
                'respondent_name', 'respondent_address', 'respondent_contact',
                'respondent_sex', 'respondent_birth_date', 'respondent_occupation',
                'respondent_civil_status', 'applicant_consent',
            ]);
        });
    }
};
