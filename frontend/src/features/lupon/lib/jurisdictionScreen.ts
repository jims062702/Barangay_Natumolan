import type { Resident } from "../../../shared/types";

/**
 * The gates a complaint has to pass, run here as well as on the server.
 *
 * The server is still the authority: every one of these runs again in
 * CaseController::store, and a queued complaint that should not have been
 * filed is refused there. But a refusal that arrives hours later is no use
 * to the clerk, who by then has told two people their case was filed and
 * sent them home.
 *
 * So the same three gates run on the device at the moment of filing. They
 * are deliberately copies of the server's, not approximations:
 *
 *   VAWC          the keyword list below is JurisdictionScreen::VAWC_KEYWORDS,
 *                 word for word. KP mediation of a VAWC matter is prohibited,
 *                 and letting one be queued — even to be refused later — puts
 *                 a survivor through barangay mediation in the meantime.
 *   jurisdiction  KP venue follows where the RESPONDENT lives, so a case
 *                 against someone outside the barangay is not this Lupon's to
 *                 hear. The register the device holds carries record_type, so
 *                 this is checkable with no line.
 *   both sides    nobody can be complainant and respondent in one dispute.
 *
 * If the server's list changes, this one has to change with it. That is the
 * cost of screening in two places, and it is worth paying: the alternative
 * is a clerk mediating a case the barangay may not hear.
 */
const VAWC_KEYWORDS = [
  "vawc", "abuse", "violence against", "domestic violence", "battery",
  "batter", "rape", "molest", "maltreat", "incest", "trafficking",
  "child abuse", "lascivious",
];

/*
 * NOBODY REPORTS BEING BEATEN IN LEGAL LANGUAGE.
 *
 * The list above catches the words a lawyer uses. A woman at the counter
 * says "my husband hit me", and in this barangay she is at least as likely
 * to say "gibunalan ko sa akong bana" or "binugbog ako ng asawa ko" — so the
 * screen that exists to keep these out of Lupon mediation waved them
 * through.
 *
 * Matched as a PAIR — harm done to somebody in a domestic relationship —
 * because "he hit my fence with his truck" is a property complaint and does
 * belong to the Lupon. JurisdictionScreen::HARM and ::DOMESTIC, word for
 * word.
 */
const HARM = [
  "hit me", "hits me", "beat me", "beats me", "beaten", "punch", "slap",
  "strangl", "choke", "kick me", "hurt me", "hurts me", "threaten to kill",
  "sinaktan", "sinasaktan", "binugbog", "bugbog", "binubugbog", "saktan",
  "gibunalan", "gisumbag", "gikulata", "gipangbunalan", "pambubugbog",
];

const DOMESTIC = [
  "husband", "wife", "spouse", "partner", "live-in", "livein", "boyfriend",
  "girlfriend", "ex-husband", "ex-wife", "father of my", "mother of my",
  "asawa", "bana", "kapikas", "nobyo", "nobya", "kinasal",
  "my child", "my son", "my daughter", "anak", "bata", "minor",
];

/** True when any of the texts reads as violence against women or children. */
export function mentionsVawc(...texts: (string | null | undefined)[]): boolean {
  const text = texts.filter(Boolean).join(" ").toLowerCase();

  if (VAWC_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return true;
  }

  /* Harm AND a domestic relationship, together. */
  return HARM.some((word) => text.includes(word))
    && DOMESTIC.some((who) => text.includes(who));
}

export interface ComplaintCheck {
  /** What to tell the clerk, or null when the complaint may be filed. */
  refusal: string | null;
  /** True when the refusal is the VAWC block, which routes rather than stops. */
  vawc: boolean;
}

/**
 * Screens a complaint the way CaseController::store does.
 *
 * `respondents` are the picked records, which carry record_type from the
 * register held on this device.
 */
export function screenComplaint(
  title: string,
  narrative: string,
  respondents: Resident[],
  complainantId: number | null,
): ComplaintCheck {
  if (complainantId && respondents.some((r) => r.id === complainantId)) {
    return {
      refusal: "The complainant cannot also be a respondent in the same case.",
      vawc: false,
    };
  }

  const outsiders = respondents
    .filter((r) => r.record_type === "Non-resident")
    .map((r) => r.first_name);

  if (outsiders.length > 0) {
    return {
      refusal: `${outsiders.join(", ")} ${outsiders.length === 1 ? "is" : "are"} recorded as `
        + "living outside Barangay Natumolan. The Lupon can only hear a case whose respondent "
        + "lives here — that is what gives it jurisdiction. The complaint must be filed with "
        + "the barangay where they reside.",
      vawc: false,
    };
  }

  if (mentionsVawc(title, narrative)) {
    return {
      refusal: "This complaint appears to involve violence against women/children. "
        + "KP mediation is prohibited for VAWC cases — please route the client to the "
        + "VAWC Desk immediately.",
      vawc: true,
    };
  }

  return { refusal: null, vawc: false };
}
