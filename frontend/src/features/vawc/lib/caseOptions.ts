/**
 * The answers the VAWC intake form offers.
 */

/**
 * What the desk records, narrowed to what it actually handles.
 *
 * It offered five kinds. The barangay VAWC desk takes threats and physical
 * violence; the rest — psychological, economic, sexual — are referred on
 * rather than docketed here, and offering them invited a case to be filed
 * where it could not be worked.
 *
 * Existing records may still hold one of the old values. Nothing rewrites
 * them: the list governs what can be CHOSEN from now on, and a case already
 * on the register keeps the words it was taken down with.
 */
export const VIOLENCE_TYPES = ["Threat", "Physical"];

/**
 * Who the person reporting is to the survivor.
 *
 * Family only, and a closed list. A complaint is brought in by a relative
 * far more often than by anyone else, and the free-text box this replaces
 * collected "mother", "Nanay", "mom" and "her mother" as four answers to one
 * question — which no report could add up.
 *
 * Distinct from OFFENDER_RELATIONSHIPS below: that one follows RA 9262 and
 * describes the accused. This one describes whoever walked in.
 */
export const REPORTER_RELATIONSHIPS = [
  "Mother",
  "Father",
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
  "Spouse",
  "Parent-in-law",
  "Sibling-in-law",
];

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
export const localNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

/**
 * How urgent a case is, most first.
 *
 * Words, not colours. A colour is unreadable to a screen reader and
 * indistinguishable to a colour-blind officer, and this is the field that
 * decides who gets visited tonight.
 */
export const RISK_LEVELS = ["Critical", "High", "Medium", "Low"] as const;

/**
 * The relationship of the VICTIM to the RESPONDENT — item 5 of the
 * Application for Barangay Protection Order, in the form's own five words.
 *
 * Written from the victim's side, which is the direction the paper form and
 * RA 9262 §3(a) both use: the law covers a wife or former wife, and a woman
 * with whom the respondent has or had a sexual or dating relationship. What
 * goes on the printed application has to be one of these, so the list the
 * desk chooses from is that list and not a paraphrase of it.
 *
 * It replaces a thirteen-item list written from the OFFENDER's side
 * ("Husband", "Former husband", "Boyfriend"…) — the same relationships named
 * backwards, which then had to be flipped by hand to fill in the form.
 *
 * "Other" stays: the law did not anticipate every household, and a case that
 * cannot be recorded is worse than one recorded imprecisely. Cases already
 * on the register keep the words they were taken down with — nothing
 * rewrites them.
 */
export const OFFENDER_RELATIONSHIPS = [
  "Wife",
  "Former Wife",
  "Live-in Relationship",
  "Dating Relationship",
  "Sexual Relationship",
  "Other",
];

/*
 * BPO_CIVIL_STATUSES is gone.
 *
 * It existed so a respondent the register had never heard of could have a
 * civil status typed for them. There is no such respondent: a barangay
 * protection order is issued against a resident of this barangay, and their
 * civil status is already on their record.
 */

/*
 * REPORTING_CHANNELS is gone.
 *
 * Every case this desk files is taken at the counter, so the question had
 * one true answer and six that were never right. A field whose answer is
 * known in advance is not a question — it is a chance to record the wrong
 * thing. Cases already on the register keep whatever channel they were
 * filed with; `reporting_channel` stays on the type for reading them.
 */

/**
 * What a survivor needs, as a list rather than a paragraph.
 *
 * Free text could not be counted, so nobody could answer "how many survivors
 * this quarter needed shelter?" — which is the question a barangay budget is
 * built on. "Other" stays, because the need nobody anticipated is exactly the
 * one worth reading.
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
