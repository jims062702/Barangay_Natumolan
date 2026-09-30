/**
 * The vocabulary of a complaint filed online, in one place.
 *
 * Both forms ask these — the public page, which knows nobody, and the
 * resident portal, which knows exactly who is filing — and the Lupon reads
 * them back on the queue. Written twice they would drift, and a list of
 * accepted ID types that differs from the server's is a form that refuses a
 * submission after the person has photographed their licence.
 *
 * FileOnlineComplaintRequest::ID_TYPES, word for word, and the five the
 * docket's own `relationship_nature` column allows.
 */

export const ID_TYPES = [
  "PhilSys / National ID",
  "Driver's Licence",
  "Passport",
  "SSS / GSIS / UMID",
  "PhilHealth ID",
  "Voter's ID",
  "Postal ID",
  "Senior Citizen ID",
  "PWD ID",
  "Barangay ID",
  "Company / School ID",
  "Other government-issued ID",
] as const;

export const RELATIONSHIPS = ["Family", "Neighbor", "Business", "Friend", "Other"] as const;

/** What a person may attach, as the file chooser's `accept`. */
export const COMPLAINT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** Up to five, and the server refuses a sixth. */
export const MAX_EVIDENCE = 5;

/**
 * Today in Manila, as YYYY-MM-DD.
 *
 * The browser's own idea of today is the device's, and a phone left on a
 * foreign timezone would offer the complainant a date the server then
 * refuses as being in the future. The office is in Manila; the form asks
 * about Manila.
 */
export function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}
