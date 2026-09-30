<?php

namespace App\Services\Public;

use App\Models\Service\Guide;
use Illuminate\Support\Str;

/**
 * AI-assisted resident inquiry (Shared Core module 4) — what the website's
 * chatbot says when Rasa is not running.
 *
 * Asked in order:
 *
 *   1. the barangay FAQ (FaqMatcher) — the same knowledge base Rasa is
 *      trained on, so the answer is the same one Rasa would give
 *   2. the service guides table, when the office has filled it in
 *   3. neither: the "could not match" answer, with the general questions
 *      offered under it
 *
 * Every answer carries `buttons` — the questions related to it — which the
 * widget shows under the answer, so what is offered next follows what was
 * just asked.
 */
final class GuideAssistant
{
    public function __construct(private readonly FaqMatcher $faq)
    {
    }

    /** @return array{answer: string, matches: \Illuminate\Support\Collection|array, buttons: array, intent: ?string} */
    public function answer(string $message): array
    {
        $known = $this->faq->answer($message);
        if ($known) {
            return [
                'answer' => $known['answer'],
                'matches' => [],
                'buttons' => $known['buttons'],
                'intent' => $known['intent'],
            ];
        }

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
                /* Somewhere to go from "could not match" — the questions the
                   chatbot does answer, right under it. */
                'buttons' => $this->faq->fallbackButtons(),
                'intent' => null,
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
            'buttons' => [],
            'intent' => null,
        ];
    }
}
