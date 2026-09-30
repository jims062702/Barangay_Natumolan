/**
 * Fixed answers the census form offers and reads against.
 */

import type { Member } from "../types";

export const BLANK_MEMBER: Member = { last_name: "", first_name: "", middle_name: "" };

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The form's own skip code.
 *
 * Printed in the margin — "For SKIPPED questions, write 99" — and then said
 * precisely: Q11 is 99 below five, Q12 to Q14 are 99 below three and at
 * twenty-five and over. It means "asked, does not apply", which is a
 * different answer from a box nobody filled in.
 */
export const SKIPPED = "99";

/**
 * Where this register is.
 *
 * Named once. The three address boxes are read-only on the form, so a form
 * that arrived without them would show three blanks nobody could fix.
 */
/* The zones come from the office's own list now — see useZones. */

/**
 * What Q32 fills in when the tick says "registered here".
 *
 * Spelled once. Ten lines typing it by hand is ten chances to spell it
 * differently, and a search for voters in this barangay finds nine of them.
 */
export const VOTER_HERE = "Barangay Natumolan";

export const HOME = {
  province: "Misamis Oriental",
  city_municipality: "Tagoloan",
  barangay: "Natumolan",
};
