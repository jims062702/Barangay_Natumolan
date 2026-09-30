<?php

/*
 * The PHP FAQ matcher must answer exactly as the Python one in
 * rasa/knowledge/generate.py — the numbers it trusts were chosen there.
 *
 *   php tests/check_faq_matcher.php
 *
 * Reads rasa/knowledge/matcher_check.json (written by generate.py) and
 * compares, question by question, the intent chosen and both scores.
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$check = json_decode(file_get_contents(__DIR__ . '/../../rasa/knowledge/matcher_check.json'), true);
$matcher = new App\Services\Public\FaqMatcher();

$same = 0;
$differ = [];
foreach ($check['checks'] as $c) {
    [$intent, $score, $runner] = $matcher->match($c['q']);
    $ok = $intent === $c['intent'] && abs($score - $c['score']) < 1e-5 && abs($runner - $c['runner']) < 1e-5;
    $ok ? $same++ : $differ[] = [$c['q'], $c['intent'], $c['score'], $intent, round($score, 6)];
}

echo "agree on {$same} of " . count($check['checks']) . " held-out questions\n";
foreach (array_slice($differ, 0, 10) as [$q, $pi, $ps, $hi, $hs]) {
    echo "  DIFFER '{$q}': python {$pi} ({$ps}) vs php {$hi} ({$hs})\n";
}
exit($differ ? 1 : 0);
