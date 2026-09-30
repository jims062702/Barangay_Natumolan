<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FILING ONLINE IS NOT FILING A CASE.
 *
 * Somebody can now begin a complaint from the public page or from their own
 * portal, and what that produces is an ONLINE COMPLAINT REFERENCE NUMBER —
 * deliberately not a KP case number. The barangay's process is unchanged:
 * the complainant still comes to the office, is still identified, the
 * complaint is still read, the fee is still paid, and only then does the
 * Lupon accept it and raise the case. What the online step buys is the
 * queue: the office reads the complaint before the person is standing at
 * the counter, and the person does not spend the visit dictating it.
 *
 * Two tables, because two quite different things are being kept.
 *
 *   online_complaints     what was submitted, and where the office has got
 *                         to with it. It holds a `lupon_case_id` only once
 *                         it has been ACCEPTED, and that is the one moment
 *                         a reference number turns into a case number.
 *
 *   pending_residents     somebody who filed as a resident and is not on
 *                         the register. NOT a resident record: the RBIM
 *                         census is the only way onto the register, and a
 *                         complaint form is not a census. This is the few
 *                         facts the Population Office needs to find them
 *                         and start the real form, so the visit is shorter.
 *
 * The valid ID is a path into `storage/app/private`, never the public disk:
 * it is a photograph of somebody's identity document, and the whole reason
 * it is asked for is to show a real person is behind the submission.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_residents', function (Blueprint $table) {
            $table->id();

            /* Only what the Population Office needs to FIND this person and
               begin the census form. The rest of RBIM is asked at the desk;
               duplicating that form online would be asking a complainant to
               fill in a census to report a fence. */
            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->string('suffix', 20)->nullable();
            $table->string('address', 255);
            $table->string('zone_purok', 40)->nullable();
            $table->string('contact_number', 50)->nullable();
            $table->date('birthdate')->nullable();
            $table->string('sex', 20)->nullable();
            $table->string('civil_status', 40)->nullable();
            $table->string('valid_id_type', 80)->nullable();
            $table->string('valid_id_number', 80)->nullable();

            /* Pending until the office completes the RBIM census, which is
               what actually puts them on the register. */
            $table->enum('status', ['Pending', 'Registered', 'Declined'])->default('Pending');
            $table->foreignId('resident_id')->nullable()->constrained('residents')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->string('notes', 255)->nullable();

            $table->timestamps();
            $table->index('status');
        });

        Schema::create('online_complaints', function (Blueprint $table) {
            $table->id();

            /* NOT a KP case number. The two are different things and the
               office must never have to guess which one they are holding. */
            $table->string('reference_no', 30)->unique();

            $table->enum('filer_kind', ['Resident', 'Non-resident']);
            /* Exactly one of these, or neither for a non-resident. */
            $table->foreignId('resident_id')->nullable()->constrained('residents')->nullOnDelete();
            $table->foreignId('pending_resident_id')->nullable()->constrained('pending_residents')->nullOnDelete();

            /* Written down even for a registered resident: the register is
               where their details are kept CURRENT, but the office has to be
               able to see what the filer typed on the day. */
            $table->string('complainant_name', 200);
            $table->string('complainant_address', 255);
            $table->string('complainant_contact', 50);

            $table->string('respondent_name', 200);
            $table->string('respondent_address', 255)->nullable();

            $table->text('narrative');
            $table->date('date_of_occurrence')->nullable();
            $table->string('place_of_occurrence', 255)->nullable();
            $table->string('relationship_nature', 100)->nullable();

            /* Required. It is what tells the office a real person is behind
               the submission rather than a script. */
            $table->string('valid_id_type', 80);
            $table->string('valid_id_number', 80)->nullable();
            $table->string('valid_id_path', 255);

            $table->enum('status', [
                'For Office Verification', 'Accepted', 'Rejected', 'Withdrawn',
            ])->default('For Office Verification');

            /* Set at acceptance and never before: this is the moment a
               reference number becomes a case number. */
            $table->foreignId('lupon_case_id')->nullable()->constrained('lupon_cases')->nullOnDelete();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('handled_at')->nullable();
            $table->string('office_notes', 500)->nullable();

            $table->timestamps();
            $table->index('status');
            $table->index('filer_kind');
        });

        Schema::create('online_complaint_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('online_complaint_id')->constrained()->cascadeOnDelete();
            /* Optional, always. A complainant with a photograph of the fence
               should be able to attach it; one without should not be stopped
               from reporting anything at all. */
            $table->string('path', 255);
            $table->string('original_name', 200);
            $table->string('mime_type', 100);
            $table->unsignedInteger('size_bytes');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('online_complaint_files');
        Schema::dropIfExists('online_complaints');
        Schema::dropIfExists('pending_residents');
    }
};
