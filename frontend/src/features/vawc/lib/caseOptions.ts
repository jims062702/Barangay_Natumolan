/**
 * The answers the VAWC intake form offers.
 */

export const VIOLENCE_TYPES = ["Physical", "Psychological", "Economic", "Sexual", "Mixed"];

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
 * Who the alleged offender is to the survivor.
 *
 * Typed free-hand before, so the same relationship arrived as "husband",
 * "Asawa", "live in partner" and "partner (live-in)" — four spellings that
 * no report could add up.
 *
 * The list follows RA 9262, which is written in terms of exactly these
 * relationships: a husband or former husband, someone she has or had a
 * sexual or dating relationship with, someone she has a child with, or her
 * own child. A relationship outside the list is still recordable — the law
 * did not anticipate every household, and neither does this.
 */
export const OFFENDER_RELATIONSHIPS = [
  "Husband",
  "Former husband",
  "Live-in partner",
  "Former live-in partner",
  "Boyfriend",
  "Former boyfriend",
  "Father of her child",
  "Parent",
  "Child",
  "Sibling",
  "Other relative",
  "Employer",
  "Other",
];

/** How the complaint reached the barangay. */
export const REPORTING_CHANNELS = [
  "Walk-in",
  "Referral",
  "Hotline",
  "Barangay official",
  "Health worker",
  "Police",
  "Other",
];

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
