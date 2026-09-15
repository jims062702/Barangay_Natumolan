/**
 * How the sector charts look and what they call things.
 */

/**
 * One hue, because this is one measure — and the app's own, not a colour
 * borrowed from a dashboard screenshot.
 *
 * #723EC3 on the white card surface was checked rather than chosen: it clears
 * the lightness band, the chroma floor and 3:1 contrast against the surface.
 * The grid and axis labels sit one shade off the surface so they stay behind
 * the data instead of competing with it.
 */
export const BRAND = "#723EC3";

export const GRID = "#ECEEF3";

export const AXIS = "#9CA3AF";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Axis labels, shortened.
 *
 * "Children Under Five" under a column 26px wide is a collision, not a label.
 * The full name is never lost: it heads the tooltip, and it is the wording on
 * the chips below.
 */
export const SHORT: Record<string, string> = {
  "Senior Citizen": "Senior",
  "Solo Parent": "Solo Parent",
  "Children Under Five": "Under 5",
  "4Ps Household": "4Ps",
};

/** How each list is used, so the page says what it is FOR and not only how many. */
export const PURPOSE: Record<string, string> = {
  "Senior Citizen": "RA 9994 benefits, pension validation",
  PWD: "RA 10754 ID and discounts",
  "Solo Parent": "RA 8972 ID and leave certification",
  Youth: "SK programmes and registration",
  Child: "Feeding and immunisation",
  "Children Under Five": "Nutrition, immunisation, weighing",
  "4Ps Household": "DSWD conditional cash transfer",
  Indigent: "Certificate of Indigency, medical assistance",
  Adult: "General adult population",
};
