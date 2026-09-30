<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Lupon case numbers in the office's own format: the filing date, then which
 * case of that month it is — 2026-08-08-01.
 *
 * The system had been numbering them KP-2026-0001, which is not what the
 * Lupon writes and not what the monthly transmittal to the court carries.
 * The cases already on file are renumbered the same way, in the order they
 * were filed (date, then the order they were entered), so every case on the
 * register reads alike.
 *
 * The number also appears in the text of notices already sent to the
 * parties ("Lupon Records — KP-2026-0001"); those are rewritten to match, or
 * a resident would be told one number and shown another.
 */
return new class extends Migration
{
    public function up(): void
    {
        $cases = DB::table('lupon_cases')
            ->where('case_number', 'like', 'KP-%')
            ->orderBy('date_filed')
            ->orderBy('id')
            ->get(['id', 'case_number', 'date_filed']);

        /* Numbers already issued in the new format, per month, so a month
           that has some keeps counting from where it is. */
        $next = [];

        foreach ($cases as $case) {
            $date = substr((string) $case->date_filed, 0, 10);
            $month = substr($date, 0, 7);

            if (! isset($next[$month])) {
                $highest = DB::table('lupon_cases')
                    ->where('case_number', 'like', $month . '-__-%')
                    ->selectRaw("MAX(CAST(SUBSTRING_INDEX(case_number, '-', -1) AS UNSIGNED)) AS highest")
                    ->value('highest');
                $next[$month] = ((int) $highest) + 1;
            }

            $number = $date . '-' . str_pad((string) $next[$month]++, 2, '0', STR_PAD_LEFT);

            $this->rename($case->id, $case->case_number, $number);
        }
    }

    public function down(): void
    {
        $cases = DB::table('lupon_cases')
            ->where('case_number', 'not like', 'KP-%')
            ->orderBy('id')
            ->get(['id', 'case_number', 'date_filed']);

        $next = [];

        foreach ($cases as $case) {
            $year = substr((string) $case->date_filed, 0, 4);
            $next[$year] = ($next[$year] ?? 0) + 1;

            $this->rename($case->id, $case->case_number, 'KP-' . $year . '-' . str_pad((string) $next[$year], 4, '0', STR_PAD_LEFT));
        }
    }

    private function rename(int $id, string $old, string $new): void
    {
        DB::table('lupon_cases')->where('id', $id)->update(['case_number' => $new]);

        foreach (['subject', 'message'] as $column) {
            DB::table('notifications')
                ->where($column, 'like', '%' . $old . '%')
                ->update([$column => DB::raw('REPLACE(' . $column . ', ' . DB::getPdo()->quote($old) . ', ' . DB::getPdo()->quote($new) . ')')]);
        }
    }
};
