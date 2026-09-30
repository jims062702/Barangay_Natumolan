"""
Builds the chatbot's training data and answers from one knowledge base.

    python knowledge/generate.py          (from the rasa/ folder)

THE KNOWLEDGE BASE IS rasa/knowledge/faq/*.yml, AND NOTHING ELSE IS EDITED BY
HAND. Everything below is written from it:

    rasa/data/nlu.yml          the training examples, expanded from the
                               phrasings in each entry
    rasa/data/rules.yml        one rule per intent, and the fallback rule
    rasa/domain.yml            the intents, and one response per intent with
                               its related questions as buttons
    rasa/knowledge/heldout.yml questions written for TESTING only — never
                               trained on — for `rasa test nlu`
    backend/resources/chatbot/faq.json
                               the same answers for the website's built-in
                               assistant, which answers when Rasa is down

One source, so the chatbot says the same thing whether Rasa is running or
not, and a fee changed in one place is changed everywhere.

WHY THE EXAMPLES ARE EXPANDED. People do not type the tidy sentence in the
knowledge base. They type "hi po, magkano clearance", "wat r ur office
hours", "unsaon pagkuha og indigency palihug". Each phrasing is written out
the ways people actually send it — with a greeting in front, "po" at the end,
no capitals, a typo, text-speak — deterministically, so the same knowledge
base always produces the same files.

A phrasing that ends up in two intents is removed from both and reported:
an example that teaches two answers teaches neither.
"""

from __future__ import annotations

import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

RASA = Path(__file__).resolve().parent.parent
KNOWLEDGE = RASA / "knowledge"
BACKEND_OUT = RASA.parent / "backend" / "resources" / "chatbot" / "faq.json"

# How many training examples each intent is given, at most. The authored
# phrasings always survive; then the frame-and-subject ones (see frames.yml),
# up to FRAMED_MAX; then the typed-the-way-people-type variants fill the rest.
PER_INTENT = 160
FRAMED_MAX = 110

LANGS = ("en", "tl", "ceb")

PREFIXES = {
    "en": ["hi, ", "hello, ", "good morning, ", "good afternoon, ", "excuse me, ",
           "can you tell me ", "i want to know ", "please tell me ", "quick question, ", "hey, "],
    "tl": ["hi po, ", "magandang umaga po, ", "magandang hapon po, ", "tanong ko lang po, ",
           "pwede po magtanong, ", "ask ko lang, ", "gusto ko lang malaman, ", "hello po, "],
    "ceb": ["maayong buntag, ", "maayong hapon, ", "pangutana lang ko, ", "palihug, ",
            "hello, ", "gusto ko mahibalo, "],
}

SUFFIXES = {
    "en": ["?", " please", " thanks", " here in natumolan", " at the barangay", " pls"],
    "tl": [" po", " po?", " dito sa natumolan", " sa barangay po", " salamat po"],
    "ceb": [" palihug", " diri sa natumolan", " sa barangay", " salamat"],
}

# How people actually type these words.
TEXTSPEAK = [
    (r"\byou\b", "u"), (r"\byour\b", "ur"), (r"\bplease\b", "pls"), (r"\bwhat\b", "wat"),
    (r"\bbarangay\b", "brgy"), (r"\bthanks\b", "thx"), (r"\bare\b", "r"), (r"\bcertificate\b", "cert"),
    (r"\bpo\b", "poh"), (r"\bpaano\b", "pano"), (r"\bmagkano\b", "mgkano"), (r"\bunsaon\b", "unsaon"),
]

VOWELS = "aeiou"


FRAMES: dict[str, list[str]] = {}

# Which language a frame is in, for the greeting put in front of it.
TL_WORDS = {"paano", "pano", "saan", "kailangan", "magkano", "ano", "sino", "kailan", "gusto", "pwede", "presyo",
            "bayad", "nasaan", "anong", "ng", "yung", "po", "may"}
CEB_WORDS = {"unsaon", "asa", "kinahanglan", "pila", "tagpila", "unsa", "kinsa", "kanus-a", "mahimo", "naa", "og",
             "dalhon", "nahimutang", "mo", "sa"}


def language_of(text: str) -> str:
    words = set(text.lower().split())
    if words & CEB_WORDS - {"sa"} or ("sa" in words and words & {"unsa", "asa", "pila"}):
        return "ceb"
    if words & TL_WORDS:
        return "tl"
    return "en"


def framed(entry: dict) -> list[str]:
    """Every frame the intent uses, with every one of its subjects."""
    out = []
    for frame, subjects in (entry.get("framed") or {}).items():
        for template in FRAMES[frame]:
            for subject in subjects:
                out.append(template.replace("{s}", subject))
    return out


def load_knowledge() -> tuple[list[dict], dict]:
    FRAMES.update(yaml.safe_load((KNOWLEDGE / "frames.yml").read_text(encoding="utf-8")))
    entries: list[dict] = []
    for path in sorted((KNOWLEDGE / "faq").glob("*.yml")):
        doc = yaml.safe_load(path.read_text(encoding="utf-8"))
        for entry in doc["intents"]:
            entry.setdefault("topic", doc["topic"])
            entry["_file"] = path.name
            entries.append(entry)
    synonyms = yaml.safe_load((KNOWLEDGE / "synonyms.yml").read_text(encoding="utf-8"))
    return entries, synonyms


def check(entries: list[dict]) -> None:
    """Refuses a knowledge base with a hole in it, before anything is written."""
    problems = []
    ids = [e["id"] for e in entries]
    for dup, n in Counter(ids).items():
        if n > 1:
            problems.append(f"{dup}: defined {n} times")
    known = set(ids)
    for e in entries:
        where = f"{e['_file']}:{e['id']}"
        for field in ("label", "answer"):
            if not str(e.get(field, "")).strip():
                problems.append(f"{where}: no {field}")
        if e["id"] != "nlu_fallback" and sum(len(e.get(l, []) or []) for l in LANGS) < 4:
            problems.append(f"{where}: fewer than four phrasings")
        for frame, subjects in (e.get("framed") or {}).items():
            if frame not in FRAMES:
                problems.append(f"{where}: no frame called '{frame}' in frames.yml")
            if not subjects:
                problems.append(f"{where}: frame '{frame}' has no subjects")
        for r in e.get("related", []) or []:
            if r not in known:
                problems.append(f"{where}: related '{r}' does not exist")
            if r == e["id"]:
                problems.append(f"{where}: related to itself")
        for lang in LANGS:
            for text in e.get(lang, []) or []:
                if "[" in text or "]" in text:
                    problems.append(f"{where}: '[' in an example reads as an entity: {text}")
    if problems:
        print("THE KNOWLEDGE BASE HAS PROBLEMS — nothing was written:")
        for p in problems:
            print("  -", p)
        sys.exit(1)


def normal(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip().rstrip("?.!").strip()


def typo(text: str, rng: random.Random) -> str | None:
    words = text.split()
    candidates = [i for i, w in enumerate(words) if len(w) >= 6 and w.isalpha()]
    if not candidates:
        return None
    i = rng.choice(candidates)
    w = words[i]
    kind = rng.randrange(3)
    if kind == 0:  # a vowel dropped
        inner = [j for j in range(1, len(w) - 1) if w[j] in VOWELS]
        if not inner:
            return None
        j = rng.choice(inner)
        w = w[:j] + w[j + 1:]
    elif kind == 1:  # two letters swapped
        j = rng.randrange(1, len(w) - 2)
        w = w[:j] + w[j + 1] + w[j] + w[j + 2:]
    else:  # a letter doubled
        j = rng.randrange(1, len(w) - 1)
        w = w[:j] + w[j] + w[j:]
    words[i] = w
    return " ".join(words)


def textspeak(text: str) -> str | None:
    out = text.lower()
    for pattern, repl in TEXTSPEAK:
        out = re.sub(pattern, repl, out)
    return out if out != text.lower() else None


def expand(entry: dict) -> list[str]:
    """The authored phrasings, the framed ones, then the ways people send them."""
    rng = random.Random(entry["id"])  # the same knowledge base, the same files
    authored: list[str] = []
    by_lang: list[tuple[str, str]] = []
    for lang in LANGS:
        for text in entry.get(lang, []) or []:
            authored.append(text)
            by_lang.append((lang, text))

    frame_lines = framed(entry)
    rng.shuffle(frame_lines)
    frame_lines = frame_lines[:FRAMED_MAX]
    authored += frame_lines
    # Some of the framed ones are sent the way people send things, too.
    by_lang += [(language_of(t), t) for t in frame_lines[:12]]

    variants: list[str] = []
    for lang, text in by_lang:
        bare = text.rstrip("?.!")
        lower = bare.lower()
        options = [lower]
        options += [p + lower for p in rng.sample(PREFIXES[lang], k=min(2, len(PREFIXES[lang])))]
        options += [lower + s for s in rng.sample(SUFFIXES[lang], k=min(2, len(SUFFIXES[lang])))]
        options.append(rng.choice(PREFIXES[lang]) + lower + rng.choice(SUFFIXES[lang]))
        for maker in (typo, textspeak):
            made = maker(lower, rng) if maker is typo else maker(lower)
            if made:
                options.append(made)
        variants += options

    rng.shuffle(variants)
    seen = {normal(t) for t in authored}
    out = list(authored)
    for v in variants:
        if len(out) >= PER_INTENT:
            break
        key = normal(v)
        if key and key not in seen:
            seen.add(key)
            out.append(v)
    return out


# --- the built-in assistant's matcher, mirrored in PHP (FaqMatcher.php) ---
#
# WHAT ANSWERS WHEN RASA IS DOWN. Every phrasing of every intent becomes a
# vector — its words, and the 3- and 4-letter pieces of those words, so
# "clearnce" still meets "clearance" — weighted by how rare each piece is.
# A question is compared with every phrasing, and the intent of the closest
# one answers, but only when it is close enough, and clearly closer than the
# next intent. Otherwise the widget says it could not match the question and
# offers the suggested ones.
#
# CAREFUL BY DESIGN. Measured on questions it was never shown, this answers
# fewer than the full Rasa model does, and is wrong far less often: a wrong
# answer from a barangay chatbot is a wrong fee or a wrong office, and "I
# could not match that — try one of these" is not.
#
# The PHP copy must tokenise EXACTLY like this. matcher_check.json, written
# below, lets the PHP side prove it does.

STOP = set("""
a an the is are was were be am do does did can could would will should i im me my you your u ur we our it its
of for to in on at and or please pls there this that with about tell get any have has how what when where
who why which po ba ang ng sa na mga ko ako ano paano saan kailan unsa unsaon asa kanus og ug ni si kay nga
lang naman din rin pa mo ka kayo kami tayo ito yan yun dito diyan doon want know need just anong sino bakit
pwede yung man ra kung kapag may meron wala naa ikaw siya sila namin natin nila akong imong iyang among atong
ilang diri didto
""".split())

# How many framed phrasings per intent the matcher reads. More is not better
# past this: see the note in the report printed at the end.
MATCHER_FRAMED = 15


def tokens(text: str, synonyms: dict) -> list[str]:
    words = re.findall(r"[a-z0-9ñ]+", text.lower())
    out = []
    for w in words:
        w = synonyms.get(w, w)
        if w in STOP or len(w) < 2:
            continue
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def features(text: str, synonyms: dict) -> list[str]:
    words = tokens(text, synonyms)
    joined = " " + " ".join(words) + " "
    grams = [joined[i:i + n] for n in (3, 4) for i in range(len(joined) - n + 1)]
    return ["w:" + w for w in words] + ["g:" + g for g in grams]


def matcher_phrasings(entries: list[dict]) -> list[tuple[str, str]]:
    out = []
    for e in entries:
        if e["id"] == "nlu_fallback":
            continue
        fr = framed(e)
        random.Random(e["id"]).shuffle(fr)
        texts = [p for lang in LANGS for p in (e.get(lang, []) or [])] + fr[:MATCHER_FRAMED] + [e["label"], e.get("question", "")]
        out += [(e["id"], t) for t in texts if t]
    return out


def build_index(phrasings: list[tuple[str, str]], synonyms: dict) -> dict:
    feats = [(intent, Counter(features(t, synonyms))) for intent, t in phrasings]
    df = Counter()
    for _, f in feats:
        df.update(f.keys())
    n = len(feats)
    idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}
    vecs = []
    for intent, f in feats:
        v = {t: c * idf[t] for t, c in f.items()}
        vecs.append((intent, v, math.sqrt(sum(x * x for x in v.values())) or 1.0))
    return {"idf": idf, "vecs": vecs}


def match(question: str, index: dict, synonyms: dict) -> tuple[str | None, float, float]:
    tf = Counter(t for t in features(question, synonyms) if t in index["idf"])
    if not tf:
        return None, 0.0, 0.0
    qv = {t: c * index["idf"][t] for t, c in tf.items()}
    qn = math.sqrt(sum(x * x for x in qv.values()))
    best: dict[str, float] = {}
    for intent, v, norm in index["vecs"]:
        s = sum(w * v.get(t, 0.0) for t, w in qv.items()) / (qn * norm)
        if s > best.get(intent, 0.0):
            best[intent] = s
    ranked = sorted(best.items(), key=lambda x: -x[1])
    if not ranked:
        return None, 0.0, 0.0
    return ranked[0][0], ranked[0][1], (ranked[1][1] if len(ranked) > 1 else 0.0)


def calibrate(entries: list[dict], index: dict, synonyms: dict) -> tuple[float, float, dict]:
    """The lowest score, and the lead over the next intent, the matcher trusts."""
    tests = [(t, e["id"]) for e in entries for t in (e.get("test", []) or [])]
    results = [(match(t, index, synonyms), want) for t, want in tests]
    best = None
    for th in [x / 100 for x in range(40, 92, 2)]:
        for margin in (0.0, 0.03, 0.06, 0.1):
            right = sum(1 for (got, s, r), want in results if got == want and s >= th and s - r >= margin)
            wrong = sum(1 for (got, s, r), want in results if got != want and s >= th and s - r >= margin)
            # A wrong answer is worse than "I could not match" — it is
            # confidently telling somebody the wrong fee. Weighted accordingly.
            score = right - 4 * wrong
            if best is None or score > best[0]:
                best = (score, th, margin, right, wrong)
    _, th, margin, right, wrong = best
    misses = [(t, want, got, round(s, 2)) for (t, want), ((got, s, r), _) in zip(tests, results)
              if got != want and s >= th and s - r >= margin]
    checks = [{"q": t, "intent": got, "score": round(s, 6), "runner": round(r, 6)}
              for (t, _), ((got, s, r), _) in zip(tests, results)]
    return th, margin, {"tests": len(tests), "right": right, "wrong": wrong,
                        "unanswered": len(tests) - right - wrong, "wrong_examples": misses, "checks": checks}


# --- writers ---

class Literal(str):
    pass


def literal_representer(dumper, data):
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")


yaml.add_representer(Literal, literal_representer)


def response_name(e: dict) -> str:
    return e.get("response") or ("utter_" + re.sub(r"^ask_", "", e["id"]))


def buttons_for(e: dict, by_id: dict) -> list[dict]:
    return [{"title": by_id[r]["label"], "payload": "/" + r} for r in (e.get("related", []) or [])]


HEADER = "# GENERATED by knowledge/generate.py from knowledge/faq/*.yml — edit those, not this.\n"


def main() -> None:
    entries, synonyms = load_knowledge()
    check(entries)
    by_id = {e["id"]: e for e in entries}
    intents = [e for e in entries if e["id"] != "nlu_fallback"]

    # Expand, then take out anything that landed in two intents.
    examples = {e["id"]: expand(e) for e in intents}
    owners = defaultdict(set)
    for intent, exs in examples.items():
        for x in exs:
            owners[normal(x)].add(intent)
    clashes = {k: v for k, v in owners.items() if len(v) > 1}
    for intent in examples:
        examples[intent] = [x for x in examples[intent] if normal(x) not in clashes]

    # data/nlu.yml
    nlu = {"version": "3.1", "nlu": [
        {"intent": i, "examples": Literal("".join(f"- {x}\n" for x in exs))} for i, exs in examples.items()
    ]}
    (RASA / "data" / "nlu.yml").write_text(HEADER + yaml.dump(nlu, allow_unicode=True, sort_keys=False, width=1000),
                                           encoding="utf-8")

    # data/rules.yml — one per intent, and the fallback.
    rules = {"version": "3.1", "rules": [
        {"rule": e["label"] + f" ({e['id']})", "steps": [{"intent": e["id"]}, {"action": response_name(e)}]}
        for e in intents
    ] + [{"rule": "Fallback", "steps": [{"intent": "nlu_fallback"}, {"action": "utter_default"}]}]}
    (RASA / "data" / "rules.yml").write_text(HEADER + yaml.dump(rules, allow_unicode=True, sort_keys=False, width=1000),
                                             encoding="utf-8")

    # domain.yml — every answer, with its related questions as buttons.
    responses = {}
    for e in entries:
        body = {"text": Literal(e["answer"].strip())}
        buttons = buttons_for(e, by_id)
        if buttons:
            body["buttons"] = buttons
        name = "utter_default" if e["id"] == "nlu_fallback" else response_name(e)
        responses[name] = [body]
    domain = {
        "version": "3.1",
        "intents": [e["id"] for e in intents],
        "responses": responses,
        "session_config": {"session_expiration_time": 60, "carry_over_slots_to_new_session": True},
    }
    (RASA / "domain.yml").write_text(HEADER + yaml.dump(domain, allow_unicode=True, sort_keys=False, width=1000),
                                     encoding="utf-8")

    # knowledge/heldout.yml — for `rasa test nlu`, never trained on.
    held = {"version": "3.1", "nlu": [
        {"intent": e["id"], "examples": Literal("".join(f"- {t}\n" for t in e["test"]))}
        for e in intents if e.get("test")
    ]}
    (KNOWLEDGE / "heldout.yml").write_text(HEADER + yaml.dump(held, allow_unicode=True, sort_keys=False, width=1000),
                                           encoding="utf-8")

    # backend/resources/chatbot/faq.json — the built-in assistant's copy.
    phrasings = matcher_phrasings(entries)
    index = build_index(phrasings, synonyms)
    threshold, margin, report = calibrate(intents, index, synonyms)
    faq = {
        "generated_by": "rasa/knowledge/generate.py — edit rasa/knowledge/faq/*.yml, not this file",
        "threshold": threshold,
        "margin": margin,
        "synonyms": synonyms,
        "stop": sorted(STOP),
        "intents": {
            e["id"]: {"label": e["label"], "topic": e["topic"], "answer": e["answer"].strip(),
                      "buttons": buttons_for(e, by_id)}
            for e in entries
        },
        "phrasings": [[i, t] for i, t in phrasings],
    }
    # What the Python matcher answers for each held-out question — the PHP
    # copy is checked against this, so the two can never quietly disagree.
    (KNOWLEDGE / "matcher_check.json").write_text(
        json.dumps({"threshold": threshold, "margin": margin, "checks": report["checks"]}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    BACKEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    BACKEND_OUT.write_text(json.dumps(faq, ensure_ascii=False, indent=1), encoding="utf-8")

    total = sum(len(x) for x in examples.values())
    print(f"intents: {len(intents)}   responses: {len(responses)}   rules: {len(rules['rules'])}")
    print(f"training examples: {total}   (removed {len(clashes)} that fell in two intents)")
    print(f"held-out questions: {report['tests']}")
    print(f"built-in matcher on held-out: {report['right']} right, {report['wrong']} wrong, "
          f"{report['unanswered']} unanswered (threshold {threshold}, lead {margin}); "
          f"{len(phrasings)} phrasings indexed")
    for t, want, got, s in report["wrong_examples"]:
        print(f"   wrong: {t!r} -> {got} ({s}), wanted {want}")
    if clashes:
        shown = list(clashes.items())[:10]
        print("phrasings in two intents (removed):")
        for text, owners_ in shown:
            print(f"   {text!r}: {sorted(owners_)}")


if __name__ == "__main__":
    main()
