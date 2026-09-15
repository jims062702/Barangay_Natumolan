/**
 * A birthdate, shown only as precisely as it is actually known.
 *
 * The RBIM census asks Q5 for a MONTH and a YEAR — no day. The register
 * stores a DATE, which needs one, so registering from a census fills in the
 * last day of that month and sets `birthdate_is_estimated` to say so.
 *
 * Every screen then printed that day as fact. A resident born in June 2002
 * opened My Profile and read "June 30, 2002" — a birthday the system had
 * made up and they had never given. Worse than merely wrong: the record
 * already knew it was a guess, and the screen was the only thing not saying
 * so.
 *
 * So the flag decides how much of the date is shown. An exact birthdate,
 * taken from a birth certificate at the counter, still prints in full.
 *
 * WHY THE STORED DAY IS THE LAST OF THE MONTH, AND STAYS THAT WAY
 *
 * The column is a DATE and a DATE needs a day, so one has to be chosen. The
 * last of the month is not an arbitrary pick — it is what makes the age come
 * out right for a record whose day nobody knows:
 *
 *   born June 2002, read on 15 June 2026  ->  23, because June is not over
 *   born June 2002, read on 30 June 2026  ->  24
 *
 * The age goes up only once the month they were born in has run out, which
 * is the most anyone can honestly say from a month and a year. Choosing the
 * 1st instead would make everybody a year older for up to a month and hand
 * out a senior citizen's entitlement — or a youth programme's cut-off — early.
 *
 * That day is machinery, not a fact about the person. It is never shown and
 * never offered for editing: see `formatBirthdate` and `birthMonthValue`.
 */

const LONG: Intl.DateTimeFormatOptions = { dateStyle: "long" };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

/**
 * @param value      the stored date, `YYYY-MM-DD`
 * @param estimated  true when only a month and a year were ever given
 */
export function formatBirthdate(
  value: string | null | undefined,
  estimated?: boolean | null,
): string {
  if (!value) {
    return "";
  }

  /*
   * Split, not `new Date(value)`.
   *
   * A bare `YYYY-MM-DD` is parsed as a UTC INSTANT and then rendered in the
   * viewer's zone, which is a category error: a date of birth has no time
   * and no zone, it is three numbers on a certificate.
   *
   * It happens not to bite here — the Philippines is ahead of UTC, and
   * being ahead cannot move a date backwards, so every value tested came
   * out on its own day. That is exactly why it is worth not relying on:
   * the failure is invisible from this barangay and lands on anyone
   * reading from a zone behind UTC.
   */
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month) {
    return "";
  }

  const local = new Date(year, month - 1, day || 1);

  return local.toLocaleDateString("en-PH", estimated ? MONTH_YEAR : LONG);
}

/**
 * The same date for a form field or a printed line — `June 2002` or
 * `30 June 2002` — with a note the reader can act on.
 *
 * Kept separate from the plain formatter because a certificate saying
 * "(month and year only)" is telling a clerk something they may need to
 * chase; a profile row saying it would only be noise.
 */
export function birthdateNote(estimated?: boolean | null): string {
  return estimated ? "Month and year only — the census did not record a day." : "";
}

/**
 * Age at last birthday.
 *
 * Whole years, counted on the calendar and not by arithmetic on
 * milliseconds. Five copies of this had grown around the app and two of
 * them divided by `31557600000` — "ms per average year" — which drifts by a
 * day every four years and puts people on the wrong side of their own
 * birthday.
 *
 * Reads the parts rather than `new Date(value)` for the reason given in
 * `formatBirthdate`: a bare `YYYY-MM-DD` becomes a UTC instant and is then
 * compared against a local clock, which is two calendars pretending to be one.
 */
export function ageFrom(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - year;

  /* Not yet reached this year's birthday means one fewer year lived. */
  const monthsApart = now.getMonth() + 1 - month;

  if (monthsApart < 0 || (monthsApart === 0 && now.getDate() < (day || 1))) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/**
 * The stored date as a month input wants it — `2002-06`.
 *
 * An estimated birthdate is edited as a month, never as a day, so the day
 * the system picked is never put in front of a clerk as something they
 * chose, or could change.
 */
export function birthMonthValue(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : "";
}

/**
 * A `YYYY-MM` from a month input, back to the date the column stores.
 *
 * The last day of that month — the same rule the census registration uses
 * on the server, kept here in one place so the two can never drift apart.
 */
export function birthMonthToDate(month: string): string {
  const [year, monthNumber] = month.slice(0, 7).split("-").map(Number);

  if (!year || !monthNumber) {
    return "";
  }

  /* Day 0 of the next month is the last day of this one. */
  const lastDay = new Date(year, monthNumber, 0).getDate();

  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
