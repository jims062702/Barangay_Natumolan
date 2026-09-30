/**
 * The answers the VAW Desk's forms offer.
 *
 * Each list mirrors the server's own (app/Models/Vawc/*), which is what
 * refuses anything else — so a word changed here has to change there too.
 */

/**
 * What the desk records, narrowed to what it actually handles.
 *
 * The barangay VAW desk takes threats and physical violence; the rest —
 * psychological, economic, sexual — are referred on rather than docketed
 * here. Existing records may still hold one of the old values, and keep it.
 *
 * `value` is what is stored ("Physical"); `label` is what the desk reads.
 */
/**
 * The four kinds RA 9262 names, and a case may be any number of them.
 *
 * The form offered two, one at a time. A woman describing a beating, the
 * threats that came with it and the wages taken off her had to be filed as
 * ONE of those and the desk chose — so the other two went unrecorded, the
 * quarterly return under-reported them, and the next officer to open the
 * file saw a narrower case than the one that walked in.
 *
 * "Threat" is no longer offered to a NEW case: a threat is psychological
 * violence under §3(c), and it is one of the acts below. Cases already
 * filed as Threat keep the word.
 */
export const VIOLENCE_TYPES = [
  { value: "Physical", label: "Physical Violence" },
  { value: "Sexual", label: "Sexual Violence" },
  { value: "Psychological", label: "Psychological Violence" },
  { value: "Economic", label: "Economic Abuse" },
];

/**
 * The specific acts under each kind, as RA 9262 §3 sets them out.
 *
 * OPTIONAL, ALWAYS. A survivor recounting what happened is not filling in a
 * checklist, and an officer who cannot find the exact act on this list must
 * still be able to record the kind. Choosing a kind is the record; choosing
 * an act is detail the desk adds when it has it.
 */
export const VIOLENCE_ACTS: Record<string, string[]> = {
  Physical: [
    "Hitting or punching", "Slapping", "Kicking", "Pushing", "Strangling",
    "Beating", "Causing physical injuries",
  ],
  Sexual: [
    "Rape", "Sexual harassment", "Acts of lasciviousness", "Forced sexual activity",
    "Forcing the victim to perform sexual acts", "Sexual coercion",
    "Prostituting the woman or child",
  ],
  Psychological: [
    "Intimidation", "Harassment", "Stalking", "Public humiliation",
    "Repeated verbal abuse", "Threatening", "Marital infidelity",
    "Controlling or frightening the victim",
    "Making the victim witness violence against another person",
  ],
  Economic: [
    "Withholding financial support", "Preventing the woman from working",
    "Controlling her money", "Depriving her or the children of financial resources",
    "Destroying or controlling property",
    "Preventing access to legitimate livelihood or financial resources",
  ],
};

/** A stored kind of violence, in the words the form uses. */
export const violenceLabel = (value: string | null | undefined) =>
  VIOLENCE_TYPES.find((t) => t.value === value)?.label ?? value ?? "—";

/**
 * Every kind a case is, spelled out.
 *
 * A case filed before the list existed still carries one word, so it falls
 * back to that rather than reading as nothing.
 */
export const violenceSummary = (
  kinds: string[] | null | undefined,
  fallback?: string | null,
) => {
  const list = kinds?.length ? kinds : (fallback ? [fallback] : []);
  return list.length ? list.map(violenceLabel).join(", ") : "—";
};

/**
 * Who reported the case — asked outright.
 *
 * It replaces a "Reported by someone other than the applicant" checkbox,
 * which said that somebody else came in but never who they were.
 */
export const REPORTER_TYPES = [
  "Victim-Survivor",
  "Parent/Guardian",
  "Relative",
  "Friend/Support Person",
  "Barangay Official",
  "Police Officer",
  "Social Worker",
  "Other",
];

/** Reporter types that are family, so asking WHICH relative makes sense. */
export const FAMILY_REPORTERS = ["Parent/Guardian", "Relative"];

/**
 * Which relative, when a relative reported it.
 *
 * A closed list: the free-text box this replaced collected "mother",
 * "Nanay", "mom" and "her mother" as four answers to one question.
 */
export const REPORTER_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Guardian",
  "Daughter",
  "Son",
  "Sister",
  "Brother",
  "Grandmother",
  "Grandfather",
  "Granddaughter",
  "Grandson",
  "Aunt",
  "Uncle",
  "Niece",
  "Nephew",
  "Cousin",
  "Parent-in-law",
  "Sibling-in-law",
];

/**
 * The relationship of the victim-survivor to the respondent.
 *
 * "Not Recorded" is stored as nothing, and "Other (Specify)" as the words
 * typed — never as the word "Other", which tells a reader nothing.
 */
export const RELATIONSHIPS = [
  "Spouse",
  "Former Spouse",
  "Cohabiting Partner",
  "Dating Partner",
  "Sexual Partner",
];

/** The select's value for "Other (Specify)". */
export const OTHER = "__other__";

/** A stored relationship → what the select and its "specify" box show. */
export function relationshipChoice(stored: string | null | undefined): { choice: string; other: string } {
  if (!stored) return { choice: "", other: "" };
  if (RELATIONSHIPS.includes(stored)) return { choice: stored, other: "" };
  return { choice: OTHER, other: stored };
}

/** The select and its "specify" box → what is stored. */
export function relationshipValue(choice: string, other: string): string | null {
  if (choice === OTHER) return other.trim() || null;
  return choice || null;
}

/** The immediate safety assessment. */
export const DANGER_ANSWERS = ["Yes", "No", "Unknown"] as const;
export const PROTECTION_ANSWERS = ["Yes", "No"] as const;

/**
 * How urgent a case is, most first.
 *
 * Words, not colours. A colour is unreadable to a screen reader and
 * indistinguishable to a colour-blind officer, and this is the field that
 * decides who gets visited tonight.
 */
export const RISK_LEVELS = ["Critical", "High", "Medium", "Low"] as const;

/* ---------------- Barangay Protection Orders ---------------- */

export const BPO_STATUSES = [
  "Not Yet Applied",
  "Application Prepared",
  "Applied",
  "Issued",
  "Not Issued",
  "Referred for TPO/PPO",
];

/** An application the desk is still working on. */
export const BPO_OPEN_STATUSES = ["Not Yet Applied", "Application Prepared", "Applied"];

/** RA 9262 §14: the Punong Barangay, or an available Kagawad. */
export const BPO_ISSUERS = ["Punong Barangay", "Barangay Kagawad"];

/** Days in effect, counting the day of issuance. */
export const BPO_DAYS = 15;

/**
 * The last day in effect for a BPO issued on `issuedOn` ("YYYY-MM-DD").
 *
 * `days` counts the day of issuance, so 2 is simply the next day — which is
 * the earliest a renewal of it can be issued.
 */
export function bpoLastDay(issuedOn: string, days: number = BPO_DAYS): string {
  const [y, m, d] = issuedOn.slice(0, 10).split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, d + days - 1));

  return last.toISOString().slice(0, 10);
}

/* ---------------- referrals ---------------- */

export const REFERRAL_DESTINATIONS = [
  "MSWDO / CSWDO",
  "PNP Women and Children Protection Desk",
  "Health Center / Hospital",
  "PAO / Legal Assistance",
  "DSWD",
  "Shelter / Temporary Safe Accommodation",
];

export const REFERRAL_REASONS = [
  "Social welfare assessment",
  "Safety/protection",
  "Medical assistance",
  "Psychosocial support",
  "Legal assistance",
  "Child welfare/support",
  "Other",
];

export const URGENCIES = ["Immediate", "Within 24 hours", "Routine"];

export const REFERRAL_STATUSES = [
  "Pending",
  "Accepted",
  "In Progress",
  "Completed",
  "Unable to Reach",
  "Declined by Client",
];

/* ---------------- follow-ups ---------------- */

export const FOLLOWUP_METHODS = ["In Person", "Phone", "Home Visit", "Referral Agency", "Other"];

export const SAFETY_STATUSES = ["Safe", "Ongoing concern", "Immediate danger", "Unknown"];

export const PROTECTION_ORDER_STATUSES = [
  "No BPO",
  "BPO applied",
  "BPO in effect",
  "BPO expired",
  "BPO violated",
  "Referred for TPO/PPO",
];

/* ---------------- documents ---------------- */

export const DOCUMENT_TYPES = [
  "BPO",
  "Incident Report",
  "Victim-Survivor Statement",
  "Referral Form",
  "Medical Document",
  "Social Case Study",
  "Police Document",
  "Court/Protection Order Document",
  "Child-related Document",
  "Other",
];

/* ---------------- case assessment & action plan ---------------- */

export const PERSONS_PRESENT = [
  "Victim-Survivor",
  "VAW Desk Officer",
  "Respondent",
  "Social Worker",
  "Support Person",
  "Other",
];

export const SERVICES_PROVIDED = [
  "BPO assistance",
  "MSWDO referral",
  "Police referral",
  "Medical referral",
  "Legal referral",
  "Psychosocial support",
  "Other",
];

/** What the victim-survivor was told and offered — the four ticks. */
export const ASSESSMENT_CHECKS = [
  { key: "informed_of_rights", label: "Victim-Survivor was informed of available rights, remedies, and support services." },
  { key: "protection_order_offered", label: "Protection-order assistance was offered/discussed." },
  { key: "referral_made", label: "Appropriate referral was made, when needed." },
  { key: "next_steps_documented", label: "Next steps were documented." },
] as const;

/* ---------------- child & dependent welfare ---------------- */

export const CHILD_RELATIONSHIPS = [
  "Child",
  "Stepchild",
  "Grandchild",
  "Sibling",
  "Niece/Nephew",
  "Ward",
  "Other",
];

export const LIVING_ARRANGEMENTS = [
  "With the victim-survivor",
  "With the respondent",
  "With both parents",
  "With relatives",
  "In a shelter",
  "Other",
];

export const SUPPORT_TYPES = ["Food", "Education", "Medical", "Clothing", "Housing", "Childcare", "Other"];

export const CURRENT_SUPPORT = ["Regular", "Irregular", "None", "Unknown"];

export const CHILD_REFERRALS = ["MSWDO/CSWDO", "PAO/Legal Assistance", "Other"];

/**
 * What a survivor needs, as a list rather than a paragraph.
 *
 * Free text could not be counted, so nobody could answer "how many survivors
 * this quarter needed shelter?" — which is the question a barangay budget is
 * built on.
 */
export const IMMEDIATE_NEEDS = [
  "Medical assistance",
  "Temporary shelter",
  "Psychological support",
  "Legal assistance",
  "Protection order assistance",
  "Police intervention",
  "Financial assistance",
];

/* ---------------- dates ---------------- */

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
export const localNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

/** Today in Manila, "YYYY-MM-DD" — for a date box's default and its max. */
export const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * A calendar date ("YYYY-MM-DD", or the same with a time after it) in words.
 *
 * Read from its parts: `new Date("2026-09-22")` is UTC midnight, which is
 * the day before anywhere west of Greenwich.
 */
export function formatDay(value: string | null | undefined, style: "long" | "medium" = "long"): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";

  return new Date(y, m - 1, d).toLocaleDateString("en-PH", { dateStyle: style });
}

/** Whole days from Manila's today to `day`, counting both: 1 on the last day. */
export function daysLeft(lastDay: string): number {
  const [y, m, d] = lastDay.split("-").map(Number);
  const [ty, tm, td] = manilaToday().split("-").map(Number);

  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000) + 1;
}
