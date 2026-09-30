/**
 * The rules behind the chatbot's limits — what is unclear, what is the same
 * question again, and what is kept between visits. No React here: the hook
 * that applies these is hooks/useChatGuard.ts, and the numbers are all in
 * CHAT_CONFIG.
 *
 * WHAT IS KEPT IN THE BROWSER, and what is not:
 *
 *   kept      the unclear-message count and its pause. Numbers only — so a
 *             reload does not reset a pause.
 *   NOT here  how many messages a guest has left today. That is counted by
 *             the server, per device (see useChatGuard) — this browser
 *             keeps only the device ID the server gave it (lib/guestDevice),
 *             never the count.
 *   NOT here  anything anybody typed. The conversation is kept for a day
 *             by lib/chatLog.ts, on its own terms — and a turn about
 *             violence or danger is never written at all. Duplicates are
 *             compared against the questions asked on this page, in memory.
 */

import { CHAT_CONFIG } from "./chatConfig";
import { remember, remembered } from "./widgetMemory";

const KEY = "bn-chat-guard";

export interface StoredGuard {
  /** Messages in a row the chatbot could not make sense of. */
  strikes: number;
  /** Epoch ms the unclear-message pause ends, or 0. */
  pausedUntil: number;
}

const EMPTY: StoredGuard = { strikes: 0, pausedUntil: 0 };

export function loadGuard(): StoredGuard {
  try {
    const raw = remembered(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<StoredGuard>;

    /* A guest count an older widget kept here is left out: the server's is the one. */
    return {
      strikes: Number(p.strikes) || 0,
      pausedUntil: Number(p.pausedUntil) || 0,
    };
  } catch {
    /* Unreadable is the same as nothing recorded. */
    return EMPTY;
  }
}

export function saveGuard(state: StoredGuard): void {
  remember(KEY, JSON.stringify(state));
}

/** Case, spacing and trailing punctuation do not make a message different. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?]+$/u, "").trim();
}

/*
 * Rows of the keyboard, run along with a finger. Only runs that no English,
 * Tagalog or Bisaya word contains: "erty" is in "property" and "wert" is in
 * "swerte", so neither is here.
 */
const MASHING = /qwert|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm|yuio|uiop/;

/**
 * Text that cannot reasonably be read as a question.
 *
 * CONSERVATIVE ON PURPOSE. Every rule here has to leave alone a real question
 * in English, Tagalog or Bisaya — "unsaon pagkuha og clearance", "ngayon",
 * "OC-2026-0001", and "hi", "help", "ok" — because a false positive tells a
 * resident their question is spam. What it catches is what nobody types by
 * accident:
 *
 *   · no letters at all                 "?????", "123456", a row of emoji
 *   · a single letter                   "k", "a"
 *   · one key held down                 "aaaaaaa"
 *   · a finger run along a row          "asdfgh", "asdfgh123", "qwerty"
 *   · six consonants in a row           "sdkfjgh"
 *   · a five-letter "word" with no vowel at all
 *   · nothing but a syllable repeated   "hehehehe", "hahaha"
 */
export function looksLikeGibberish(raw: string): boolean {
  const text = raw.trim().toLowerCase();
  if (!text) return true;

  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return true;
  if (letters.length === 1) return true;

  if (/(.)\1{5,}/u.test(text)) return true;
  if (MASHING.test(text)) return true;
  if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(text)) return true;
  if (/(^|[^a-z])[bcdfghjklmnpqrstvwxz]{5,}($|[^a-z])/.test(text)) return true;

  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length > 0 && words.every((w) => /^(\p{L}{1,3})\1{2,}\p{L}{0,2}$/u.test(w))) return true;

  return false;
}

/*
 * THE SAME QUESTION, ASKED DIFFERENTLY.
 *
 * "What are your office hours?", "What is the barangay office hours?" and
 * "When is the barangay office open?" are one question. They are reduced to
 * what they are ABOUT — the words that are left once the question words and
 * the barangay's own name are taken out, with a few words that mean the same
 * thing here folded together — and compared as sets.
 *
 * It is a light touch, deliberately. "How much is a clearance?" and "What do
 * I need for a clearance?" share the clearance and nothing else, and are two
 * questions; telling somebody they have already asked the second would be
 * wrong. Only a near-total overlap counts.
 */
const IGNORED = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "what", "whats", "when", "where", "how",
  "who", "why", "which", "do", "does", "did", "can", "could", "would", "will", "i", "im", "you",
  "your", "my", "me", "we", "our", "it", "its", "of", "for", "to", "in", "on", "at", "and", "or",
  "please", "pls", "there", "this", "that", "with", "about", "tell", "get", "any", "have", "has",
  "barangay", "brgy", "natumolan",
  "po", "ba", "ang", "ng", "sa", "na", "mga", "ko", "ako", "ano", "paano", "saan", "kailan",
  "unsa", "unsaon", "asa", "kanus", "og", "ug", "ni", "si", "kay", "nga",
]);

const SAME_THING: Record<string, string> = {
  open: "hours", opens: "hours", opening: "hours", hour: "hours", hours: "hours",
  schedule: "hours", time: "hours", oras: "hours", bukas: "hours", sched: "hours",
  fee: "fee", fees: "fee", cost: "fee", costs: "fee", price: "fee", much: "fee",
  magkano: "fee", bayad: "fee", pila: "fee",
  requirement: "requirement", requirements: "requirement", need: "requirement",
  needed: "requirement", kailangan: "requirement", bring: "requirement",
  certificate: "certificate", certificates: "certificate", certification: "certificate", cert: "certificate",
  clearance: "clearance", clearances: "clearance",
  complaint: "complaint", complaints: "complaint", complain: "complaint", reklamo: "complaint",
  office: "office", offices: "office", opisina: "office",
};

/** What a question is about, as a set of words. */
export function topicWords(text: string): Set<string> {
  return new Set(
    normalise(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w && !IGNORED.has(w))
      .map((w) => SAME_THING[w] ?? (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/** Whether two messages are the same question. */
export function sameQuestion(a: string, b: string): boolean {
  if (normalise(a) === normalise(b)) return true;

  const x = topicWords(a);
  const y = topicWords(b);
  if (x.size === 0 || y.size === 0) return false;

  let shared = 0;
  x.forEach((w) => { if (y.has(w)) shared++; });

  return shared / (x.size + y.size - shared) >= CHAT_CONFIG.similarity;
}

/** "1:42" — what is left of a wait, for a wait of a minute or more. */
export function formatWait(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "23 hours 41 minutes" — for a wait measured in hours, like the guest limit. */
export function describeLongWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "minute" : "minutes"}` : "";

  return [h, m].filter(Boolean).join(" ");
}

/** "Sep 27, 3:15 PM" — when, in the barangay's own time. */
export function describeWhen(at: number): string {
  return new Date(at).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** "8 seconds" / "1:42" — whichever reads naturally for this wait. */
export function describeWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));

  return seconds < 60 ? `${seconds} ${seconds === 1 ? "second" : "seconds"}` : formatWait(ms);
}
