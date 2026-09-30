/**
 * Somebody who may be in danger right now.
 *
 * WHY THIS IS NOT LEFT TO THE CHATBOT. Measured on questions it had never
 * seen, the chatbot answered "someone is attacking my sister right now" and
 * "may nananakit po sa akin" with "Sorry, I did not quite get that" — its
 * guess was right, but not confident enough to say. For most questions that
 * is the right caution. For these it is the one answer that must never be
 * given.
 *
 * So the widget looks for danger itself, and when it sees it, the answer
 * STARTS with 911 — whatever the chatbot says after it. It adds to the
 * answer; it never replaces one.
 *
 * Deliberately broad. A line about 911 under a question that was not an
 * emergency costs the reader a second. Missing one that was costs far more.
 */

/* Not "shot": a baby's shots are vaccines, and that question is common here. */
const WORDS = [
  "emergency", "in danger", "attack(?:ing|ed)?", "stab(?:bed|bing)?", "knife", "kutsilyo", "gun",
  "baril", "binaril", "bleeding", "dugo", "kill me", "papatayin", "patyon", "fire", "sunog",
  "nasusunog", "help me now", "tulungan nyo ako", "tulungan niyo ako", "tabangi ko", "saklolo",
  "hurting me", "hitting me", "nananakit", "sinasaktan ako", "gisakitan ko",
];

const DANGER = new RegExp(`\\b(?:${WORDS.join("|")})\\b`, "i");

export function looksLikeEmergency(text: string): boolean {
  return DANGER.test(text);
}

export const EMERGENCY_NOTE =
  "If you or someone else is in danger right now, call 911, or go to the nearest police station. "
  + "Get to a safe place first if you can.";
