<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Set August cases (filed 2026-08-10) to 2026-08-10-01 .. 05
        $augustMap = [
            73 => '2026-08-10-01',
            74 => '2026-08-10-02',
            75 => '2026-08-10-03',
            76 => '2026-08-10-04',
            77 => '2026-08-10-05',
        ];

        foreach ($augustMap as $id => $num) {
            DB::table('lupon_cases')->where('id', $id)->update(['case_number' => $num]);
        }

        // 2. Set October cases back to starting at 01 for the new month
        $octoberMap = [
            1 => '2026-10-02-01',
            2 => '2026-10-02-02',
            3 => '2026-10-02-03',
            4 => '2026-10-02-04',
            5 => '2026-10-02-05',
            65 => '2026-10-02-06',
            66 => '2026-10-02-07',
            67 => '2026-10-02-08',
            68 => '2026-10-03-09',
            69 => '2026-10-03-10',
            70 => '2026-10-04-11',
            71 => '2026-10-04-12',
            72 => '2026-10-04-13',
        ];

        foreach ($octoberMap as $id => $num) {
            DB::table('lupon_cases')->where('id', $id)->update(['case_number' => $num]);
        }
    }

    public function down(): void
    {
    }
};

