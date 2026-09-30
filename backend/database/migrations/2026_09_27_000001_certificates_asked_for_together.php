<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * A resident who needs two kinds of certificate is served in ONE transaction
 * instead of queueing again for the second.
 *
 *   service_requests.transaction_code     the certificates asked for together
 *                                         share it. Each type is still its own
 *                                         request and its own certificate, with
 *                                         its own number and status; the code
 *                                         is what ties them into one visit.
 *
 * Every existing request stands alone — which is what it was.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->string('transaction_code', 24)->nullable()->after('request_number');
            $table->index('transaction_code');
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropIndex(['transaction_code']);
            $table->dropColumn('transaction_code');
        });
    }
};
