<?php

namespace App\Support;

/**
 * NATIONALITY, AS THE RBIM ASKS IT — Q7.
 *
 *   1   Filipino
 *   2   not Filipino — and then what they are: "2, Japanese"
 *
 * The register keeps the answer in words ("Filipino", "Japanese"), which is
 * what the Resident ID prints. A 2 with nothing written after it is kept as
 * "Non-Filipino" — true, and all the form said. Anything that is neither
 * code is NOT guessed at: it is left blank for the office to fill in.
 */
final class Nationality
{
    public const FILIPINO = 'Filipino';
    public const NON_FILIPINO = 'Non-Filipino';

    /** A census line's Q7 code and its "please specify". */
    public static function fromCode($code, ?string $other = null): ?string
    {
        return match ((int) $code) {
            1 => self::FILIPINO,
            2 => self::named($other) ?? self::NON_FILIPINO,
            default => null,
        };
    }

    /**
     * Q7 as the encoding sheet writes it in one cell: "1", "2", "2, Japanese",
     * "2 - Japanese" — or the word itself, "Filipino". Null when it is none
     * of these ("I", "0", "98").
     */
    public static function fromSheet(?string $raw): ?string
    {
        $raw = trim((string) $raw);

        if ($raw === '') {
            return null;
        }

        if (preg_match('/^0*1(?:\.0+)?$/', $raw)) {
            return self::FILIPINO;
        }

        if (preg_match('/^0*2(?:\.0+)?(?:\s*[,;:\-\/]\s*(.*)|\s+(.*))?$/u', $raw, $m)) {
            return self::fromCode(2, ($m[1] ?? '') !== '' ? $m[1] : ($m[2] ?? null));
        }

        /* Written out in words — at least three letters, nothing else. */
        if (preg_match('/^\p{L}[\p{L} \-]{2,}$/u', $raw)) {
            return self::named($raw);
        }

        return null;
    }

    /** "japanese " → "Japanese"; "FILIPINO" → "Filipino". */
    public static function named(?string $text): ?string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', (string) $text));

        if ($text === '') {
            return null;
        }

        return mb_convert_case(mb_strtolower($text), MB_CASE_TITLE);
    }
}
