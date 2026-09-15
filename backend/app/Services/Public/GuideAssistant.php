<?php

namespace App\Services\Public;

use App\Models\Service\Guide;
use Illuminate\Support\Str;

/**
 * AI-assisted resident inquiry (Shared Core module 4).
 *
 * Currently a rule-based search over the service_guides knowledge base; an
 * LLM can be plugged in here later without changing the contract.
 */
final class GuideAssistant
{
    /** @return array{answer: string, matches: \Illuminate\Support\Collection} */
    public function answer(string $message): array
    {
        $terms = collect(preg_split('/[^a-z0-9]+/i', Str::lower($message)))
            ->filter(fn ($t) => strlen($t) >= 3)
            ->unique()
            ->values();

        $guides = Guide::where('is_active', true)->get();

        $scored = $guides->map(function ($guide) use ($terms) {
            $haystack = Str::lower(implode(' ', [
                $guide->service_name,
                $guide->description,
                $guide->keywords,
                $guide->office,
            ]));

            $score = $terms->sum(fn ($term) => substr_count($haystack, $term));

            return ['guide' => $guide, 'score' => $score];
        })->filter(fn ($row) => $row['score'] > 0)
          ->sortByDesc('score')
          ->take(3)
          ->values();

        if ($scored->isEmpty()) {
            return [
                'answer' => 'I could not match your question to a specific service. '
                    . 'You may visit the Barangay Main Office (Mon–Fri, 8:00 AM–5:00 PM) '
                    . 'or browse the offices: Main Office, VAWC Desk, Lupon Tagapamayapa, '
                    . 'Population Office, and the Health Station.',
                'matches' => [],
            ];
        }

        $top = $scored->first()['guide'];

        $answer = sprintf(
            "For \"%s\", please proceed to the %s.\n\nRequirements: %s\nFees: %s\nSchedule: %s",
            $top->service_name,
            $top->office,
            $top->requirements ?: 'None listed',
            $top->fees ?: 'Free',
            $top->schedule ?: 'Mon–Fri, 8:00 AM–5:00 PM'
        );

        return [
            'answer' => $answer,
            'matches' => $scored->map(fn ($row) => $row['guide']),
        ];
    }
}
