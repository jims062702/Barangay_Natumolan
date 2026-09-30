<?php

namespace App\Services\Public;

/**
 * The barangay FAQ, answered without Rasa.
 *
 * The knowledge base is rasa/knowledge/faq/*.yml; rasa/knowledge/generate.py
 * writes the same answers for Rasa AND to resources/chatbot/faq.json, which
 * this reads. So the chatbot says the same thing whether Rasa is running or
 * not — and when it is not, which is often, the widget still answers the
 * questions the barangay is asked, instead of "I could not match your
 * question" to all of them.
 *
 * THIS IS A COPY OF THE PYTHON MATCHER IN generate.py, and must stay one.
 * Every question is broken into its words and the 3- and 4-letter pieces of
 * them, weighted by how rare each piece is, and compared with every phrasing
 * of every intent. The closest intent answers — but only when it is close
 * enough and clearly ahead of the next one; otherwise nothing is claimed.
 * generate.py chose those two numbers on questions it had never seen,
 * counting a wrong answer as four times worse than no answer: a wrong answer
 * here is a wrong fee or a wrong office.
 *
 * rasa/knowledge/matcher_check.json holds what the Python side answered for
 * those questions; tests/check_faq_matcher.php proves this one agrees.
 */
final class FaqMatcher
{
    private const SOURCE = 'resources/chatbot/faq.json';

    private ?array $faq = null;

    /** @var array{idf: array<string,float>, postings: array<string, array<int,int>>, norms: float[], owners: string[]}|null */
    private ?array $index = null;

    /**
     * The answer for a question, or null when there is no confident one.
     *
     * A button's payload — "/ask_clearance_fee" — is the intent itself, and
     * is answered directly: pressing a suggested question must always work,
     * Rasa or no Rasa.
     *
     * @return array{intent: string, answer: string, buttons: array, score: float}|null
     */
    public function answer(string $message): ?array
    {
        $faq = $this->faq();
        if (! $faq) {
            return null;
        }

        if (preg_match('/^\/([a-z0-9_]+)$/', trim($message), $m) && isset($faq['intents'][$m[1]])) {
            return $this->reply($m[1], 1.0);
        }

        [$intent, $score, $runner] = $this->match($message);

        if ($intent === null || $score < $faq['threshold'] || $score - $runner < $faq['margin']) {
            return null;
        }

        return $this->reply($intent, $score);
    }

    /** The follow-ups offered under an answer that did not come from the FAQ. */
    public function fallbackButtons(): array
    {
        return $this->faq()['intents']['nlu_fallback']['buttons'] ?? [];
    }

    /**
     * Closest intent, its score, and the next intent's score.
     *
     * @return array{0: ?string, 1: float, 2: float}
     */
    public function match(string $question): array
    {
        $index = $this->index();
        $tf = [];
        foreach ($this->features($question) as $f) {
            if (isset($index['idf'][$f])) {
                $tf[$f] = ($tf[$f] ?? 0) + 1;
            }
        }
        if (! $tf) {
            return [null, 0.0, 0.0];
        }

        $qv = [];
        $qn = 0.0;
        foreach ($tf as $f => $c) {
            $qv[$f] = $c * $index['idf'][$f];
            $qn += $qv[$f] ** 2;
        }
        $qn = sqrt($qn);

        /* Only the phrasings that share a piece with the question are
           touched — the postings list says which. */
        $dots = [];
        foreach ($qv as $f => $w) {
            $list = $index['postings'][$f];
            for ($i = 0, $n = count($list); $i < $n; $i += 2) {
                $p = $list[$i];
                $dots[$p] = ($dots[$p] ?? 0.0) + $w * $list[$i + 1] * $index['idf'][$f];
            }
        }

        /* In phrasing order, as the Python side walks them: two intents that
           score exactly the same then come out in the same order on both
           sides, and a tie is broken identically. */
        ksort($dots);

        $best = [];
        foreach ($dots as $p => $dot) {
            $s = $dot / ($qn * $index['norms'][$p]);
            $intent = $index['owners'][$p];
            if ($s > ($best[$intent] ?? 0.0)) {
                $best[$intent] = $s;
            }
        }
        if (! $best) {
            return [null, 0.0, 0.0];
        }

        arsort($best);
        $scores = array_values($best);

        return [array_key_first($best), $scores[0], $scores[1] ?? 0.0];
    }

    /** Words, as generate.py's tokens(). */
    public function tokens(string $text): array
    {
        $faq = $this->faq();
        $stop = array_flip($faq['stop']);
        preg_match_all('/[a-z0-9ñ]+/u', mb_strtolower($text), $m);

        $out = [];
        foreach ($m[0] as $w) {
            $w = $faq['synonyms'][$w] ?? $w;
            if (isset($stop[$w]) || mb_strlen($w) < 2) {
                continue;
            }
            if (mb_strlen($w) > 4 && str_ends_with($w, 's') && ! str_ends_with($w, 'ss')) {
                $w = mb_substr($w, 0, -1);
            }
            $out[] = $w;
        }

        return $out;
    }

    /** Words and their 3- and 4-letter pieces, as generate.py's features(). */
    public function features(string $text): array
    {
        $words = $this->tokens($text);
        $joined = ' ' . implode(' ', $words) . ' ';
        $chars = mb_str_split($joined);
        $len = count($chars);

        $out = array_map(fn ($w) => 'w:' . $w, $words);
        foreach ([3, 4] as $n) {
            for ($i = 0; $i + $n <= $len; $i++) {
                $out[] = 'g:' . implode('', array_slice($chars, $i, $n));
            }
        }

        return $out;
    }

    private function reply(string $intent, float $score): array
    {
        $entry = $this->faq()['intents'][$intent];

        return [
            'intent' => $intent,
            'answer' => $entry['answer'],
            'buttons' => $entry['buttons'],
            'score' => round($score, 4),
        ];
    }

    private function faq(): ?array
    {
        if ($this->faq === null) {
            $path = base_path(self::SOURCE);
            $this->faq = is_file($path) ? (json_decode((string) file_get_contents($path), true) ?: []) : [];
        }

        return $this->faq ?: null;
    }

    /**
     * The index, built once per version of faq.json and kept on disk.
     *
     * Building it reads three thousand phrasings; a chat message should not
     * wait for that. It is stored serialised under storage/, keyed by the
     * file's contents, so a regenerated faq.json is picked up by itself.
     */
    private function index(): array
    {
        if ($this->index !== null) {
            return $this->index;
        }

        $source = base_path(self::SOURCE);
        $key = md5_file($source);
        $cache = storage_path("framework/cache/chatbot-faq-{$key}.bin");

        if (is_file($cache)) {
            $loaded = @unserialize((string) file_get_contents($cache), ['allowed_classes' => false]);
            if (is_array($loaded)) {
                return $this->index = $loaded;
            }
        }

        $counts = [];
        $owners = [];
        foreach ($this->faq()['phrasings'] as $p => [$intent, $text]) {
            $owners[$p] = $intent;
            $c = [];
            foreach ($this->features($text) as $f) {
                $c[$f] = ($c[$f] ?? 0) + 1;
            }
            $counts[$p] = $c;
        }

        $n = count($counts);
        $df = [];
        foreach ($counts as $c) {
            foreach ($c as $f => $_) {
                $df[$f] = ($df[$f] ?? 0) + 1;
            }
        }
        $idf = [];
        foreach ($df as $f => $d) {
            $idf[$f] = log(($n + 1) / ($d + 1)) + 1;
        }

        $postings = [];
        $norms = [];
        foreach ($counts as $p => $c) {
            $sq = 0.0;
            foreach ($c as $f => $k) {
                $postings[$f][] = $p;
                $postings[$f][] = $k;
                $sq += ($k * $idf[$f]) ** 2;
            }
            $norms[$p] = sqrt($sq) ?: 1.0;
        }

        $this->index = ['idf' => $idf, 'postings' => $postings, 'norms' => $norms, 'owners' => $owners];

        /* Older versions are removed as the new one is written. */
        foreach (glob(storage_path('framework/cache/chatbot-faq-*.bin')) ?: [] as $old) {
            @unlink($old);
        }
        @file_put_contents($cache, serialize($this->index));

        return $this->index;
    }
}
