/**
 * What the Child Health, Maternal Health and Prenatal pages share.
 *
 * Nothing here judges a reading. The nutritional statuses are the station's
 * own list — the options the form has always offered — and one is CHOSEN by
 * the health worker; nothing works it out from a weight.
 */

/** The station's list, in the order the form has always shown it. Mirrors ChildRecord::NUTRITIONAL_STATUSES. */
export const NUTRITIONAL_STATUSES = ["Normal", "Underweight", "Severely Underweight", "Overweight", "Stunted"] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Today in Manila, "YYYY-MM-DD" — the server's clock is UTC. */
export const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export const manilaYear = () => Number(manilaToday().slice(0, 4));
export const manilaMonth = () => Number(manilaToday().slice(5, 7));

/** The years a filter offers: this one back to 2020. */
export const filterYears = () => {
  const now = manilaYear();

  return Array.from({ length: now - 2019 }, (_, i) => now - i);
};

/**
 * "2026-09-15" → "Sep 15, 2026".
 *
 * Read as a calendar date, never through `new Date(string)`: that is UTC
 * midnight, which a browser anywhere west of Greenwich shows as the day
 * before.
 */
export function fmtDate(ymd: string | null | undefined, long = false): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";

  return new Date(y, m - 1, d).toLocaleDateString("en-PH", {
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole years from one calendar date to another. */
export function ageOn(birth: string | null | undefined, on: string): number | null {
  if (!birth || !on) return null;
  const [by, bm, bd] = birth.slice(0, 10).split("-").map(Number);
  const [y, m, d] = on.slice(0, 10).split("-").map(Number);
  if (!by || !y) return null;
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;

  return age >= 0 ? age : null;
}

/** "57.80" → "57.8": the number as it was written, without the column's padding. */
export function measure(value: string | number | null | undefined, unit = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);

  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))}${unit ? ` ${unit}` : ""}`;
}

/** Yes / No / Not specified — the three answers the record can give. */
export const yesNo = (value: boolean | null | undefined) =>
  value === true ? "Yes" : value === false ? "No" : "Not specified";
