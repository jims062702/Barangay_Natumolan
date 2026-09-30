<?php

namespace App\Services\Service;

use App\Models\Service\Certificate;
use App\Support\ManilaTime;
use Carbon\Carbon;

/**
 * The Monthly Summary of Availees/Beneficiaries — First-Time Jobseekers
 * (RA 11261), month by month for one year, for the DILG through the
 * municipality.
 *
 * An availee is a First-Time Jobseeker certificate the office took up —
 * processing, ready or released — counted in the month it was asked for
 * (Manila's month), as the Certificate Report counts. A cancelled request,
 * or one still waiting online, availed of nothing.
 *
 * Educational level and school status are the certificate's own answers,
 * asked when it is filed. Where the level was never answered it is read off
 * the register, when the register says it plainly; OSY/ISY has no such
 * fallback. Sex comes from the register, or from what the counter typed for
 * somebody not on it. An availee missing any of the three is still counted
 * in the month's total, but not in those columns — and is reported as
 * missing, so the office can answer it on the certificate.
 */
final class JobseekerSummary
{
    public const TYPE = 'First-Time Jobseeker';

    /** The form's two columns for educational level. */
    public const BASIC = 'Elem/High School/Senior High School';

    public const COLLEGE = 'College Grad./Level';

    public const OSY = 'OSY';

    public const ISY = 'ISY';

    private const TAKEN_UP = ['Processing', 'Ready to Claim', 'Released'];

    public function build(int $year): array
    {
        $now = Carbon::now(ManilaTime::ZONE);

        /* "As of" is this month when the year is this year, else December. */
        $asOfMonth = $year === $now->year ? $now->month : ($year < $now->year ? 12 : 0);

        $certificates = Certificate::with('resident:id,gender,educational_attainment')
            ->where('certificate_type', self::TYPE)
            ->whereIn('status', self::TAKEN_UP)
            /* A little either side, then sorted into Manila months below. */
            ->whereBetween('created_at', [
                Carbon::create($year, 1, 1, 0, 0, 0, ManilaTime::ZONE)->utc(),
                Carbon::create($year, 12, 31, 23, 59, 59, ManilaTime::ZONE)->utc(),
            ])
            ->get();

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[$m] = $m <= $asOfMonth
                ? ['total' => 0, 'male' => 0, 'female' => 0, 'basic' => 0, 'college' => 0, 'osy' => 0, 'isy' => 0]
                : null;
        }

        $unanswered = 0;

        foreach ($certificates as $certificate) {
            $m = $certificate->created_at->copy()->setTimezone(ManilaTime::ZONE)->month;

            if ($months[$m] === null) {
                continue;
            }

            $fields = $certificate->template_fields ?? [];
            $gender = $certificate->resident?->gender ?? ($certificate->unlisted_person['gender'] ?? null);
            $level = $fields['educational_level'] ?? null
                ?: self::levelFromRegister($certificate->resident?->educational_attainment);
            $status = $fields['school_status'] ?? null;

            $row = &$months[$m];
            $row['total']++;
            $row['male'] += $gender === 'Male' ? 1 : 0;
            $row['female'] += $gender === 'Female' ? 1 : 0;
            $row['basic'] += $level === self::BASIC ? 1 : 0;
            $row['college'] += $level === self::COLLEGE ? 1 : 0;
            $row['osy'] += $status === self::OSY ? 1 : 0;
            $row['isy'] += $status === self::ISY ? 1 : 0;
            unset($row);

            if (! in_array($level, [self::BASIC, self::COLLEGE], true)
                || ! in_array($status, [self::OSY, self::ISY], true)
                || ! in_array($gender, ['Male', 'Female'], true)) {
                $unanswered++;
            }
        }

        $totals = ['total' => 0, 'male' => 0, 'female' => 0, 'basic' => 0, 'college' => 0, 'osy' => 0, 'isy' => 0];
        foreach (array_filter($months) as $row) {
            foreach ($totals as $key => $_) {
                $totals[$key] += $row[$key];
            }
        }

        return [
            'year' => $year,
            'as_of_month' => $asOfMonth,
            /* "AUGUST, 2026" — the month and year the summary runs to. */
            'as_of' => $asOfMonth ? mb_strtoupper(Carbon::create($year, $asOfMonth, 1)->format('F')) . ', ' . $year : null,
            'months' => array_values($months),
            'totals' => $totals,
            /* Availees whose level or OSY/ISY is not recorded — they are in
               the count, but not in those columns. */
            'unanswered' => $unanswered,
        ];
    }

    /**
     * The register's answer, where it maps plainly onto the form's two
     * columns. Vocational, pre-school and "no education" do not, and are
     * left for the clerk to answer on the certificate.
     */
    public static function levelFromRegister(?string $attainment): ?string
    {
        $a = strtolower(trim((string) $attainment));

        return match (true) {
            str_contains($a, 'college') => self::COLLEGE,
            str_contains($a, 'elementary'), str_contains($a, 'high school'), str_contains($a, 'junior hs'),
            str_contains($a, 'senior hs') => self::BASIC,
            default => null,
        };
    }
}
