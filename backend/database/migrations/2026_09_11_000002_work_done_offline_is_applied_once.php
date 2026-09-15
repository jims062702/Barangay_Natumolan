<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A job sent twice is applied once.
 *
 * An office working with no line keeps what it does on the device and sends
 * it when the line returns. The hard part is not sending — it is that a
 * request can ARRIVE and its reply be lost on the way back. The device
 * cannot tell that from a request that never landed, so it must be free to
 * send again; and if sending again applies the work twice, the barangay
 * gets two certificates with two numbers for one resident.
 *
 * So every queued job carries an id made on the device, and this table
 * remembers the ones already applied along with the answer they got. A
 * repeat is answered from here — the same reply as the first time, so the
 * device sees success and stops asking — without the work running again.
 *
 * Rows are kept a while and then swept: they are only useful for as long as
 * a device might still retry, and this barangay's outages are measured in
 * hours or days, not months.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offline_jobs', function (Blueprint $table) {
            $table->id();

            /*
             * The device's id for this piece of work. Unique, because that
             * uniqueness IS the guarantee — two requests carrying the same
             * id are the same job by definition, and the database is what
             * makes that true under two requests arriving at once.
             */
            $table->string('job_id', 64)->unique();

            /* Whose work it was, so one account cannot replay another's. */
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('method', 10);
            $table->string('path', 255);

            /* The reply the first attempt produced, returned verbatim to a
               repeat so the device sees exactly what it would have seen. */
            $table->unsignedSmallInteger('status_code');
            $table->longText('response')->nullable();

            $table->timestamps();

            /* For the sweep. */
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_jobs');
    }
};
