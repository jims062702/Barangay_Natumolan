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
 * never offered for editing: see `formatBirthdate`, and the date boxes that
 * start empty for such a record (ResidentFormFields, ResidentEdit).
 */

const LONG: Intl.DateTimeFormatOptions = { dateStyle: "long" };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

/**
 * Safely extract year, month (1-12), and day from any date representation
 * (whether "YYYY-MM-DD" or an ISO string with time "YYYY-MM-DDTHH:mm:ss.sssZ").
 */
export function parseDateParts(value: string | null | undefined): [number, number, number] | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // If it contains "T" (ISO timestamp with time, e.g. from UTC conversion),
  // parse with Date so the client converts it into their local day (UTC+8 in Philippines).
  if (str.includes("T")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    }
  }

  // Bare YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(str);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] ? Number(match[3]) : 1;
    if (year && month) {
      return [year, month, day];
    }
  }

  const [year, month, day] = str.slice(0, 10).split("-").map(Number);
  if (!year || !month) return null;
  return [year, month, day || 1];
}

/** Formats as standard YYYY-MM-DD (e.g. for HTML input type="date") */
export function toISODateString(value: string | null | undefined): string {
  const parts = parseDateParts(value);
  if (!parts) return "";
  const [year, month, day] = parts;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * @param value      the stored date, `YYYY-MM-DD` or ISO string
 * @param estimated  true when only a month and a year were ever given
 */
export function formatBirthdate(
  value: string | null | undefined,
  estimated?: boolean | null,
): string {
  const parts = parseDateParts(value);
  if (!parts) return "";

  const [year, month, day] = parts;
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
  return estimated ? "Only the month and year are on record — the full date has not been entered yet." : "";
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
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }

  const [year, month, day] = parts;

  const now = new Date();
  let age = now.getFullYear() - year;

  /* Not yet reached this year's birthday means one fewer year lived. */
  const monthsApart = now.getMonth() + 1 - month;

  if (monthsApart < 0 || (monthsApart === 0 && now.getDate() < (day || 1))) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
