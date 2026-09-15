/**
 * Small rules the post desk shares: statuses, dates, bylines.
 */

export const STATUSES = ["Draft", "Published", "Archived"] as const;

/**
 * "YYYY-MM-DD" for a date input, taken from the stored string rather than via
 * `new Date(...)` — parsing a UTC timestamp and formatting it back locally
 * shifts the day by one in PH time.
 */
export const asDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "");

/** A sensible byline for whoever is posting, so the field is rarely empty. */
export function bylineFor(office?: string | null, role?: string | null): string {
  if (office === "SK") return "SK Secretary";
  if (office) return `${office} Office`;

  return role ?? "";
}
