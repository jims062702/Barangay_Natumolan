<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A certificate for somebody the Population Office has not listed yet.
 *
 * A resident can walk up to the counter before the BPO has put them on the
 * register — a new household, a census line still on paper. The Clerk must
 * not add them to the register (that is the BPO's, and a register typed in
 * at two desks is a register with two of everybody). So the certificate is
 * filed with no resident record behind it, and carries what the paper prints
 * about the person — their name, zone, and whatever else that certificate
 * states — as the clerk typed it.
 *
 * resident_id stays a foreign key, and stays filled for everybody who IS on
 * the register; it is only allowed to be empty now.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->unsignedBigInteger('resident_id')->nullable()->change();
            $table->json('unlisted_person')->nullable()->after('resident_id');
        });
    }

    public function down(): void
    {
        Schema::table('certificates_clearances', function (Blueprint $table) {
            $table->dropColumn('unlisted_person');
        });
    }
};
