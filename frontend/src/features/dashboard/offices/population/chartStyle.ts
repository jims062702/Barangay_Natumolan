/**
 * How the population charts look.
 */

/*
 * Magnitude is one hue — the app's own, checked rather than chosen: #723EC3
 * on a white card clears the lightness band, the chroma floor and 3:1
 * contrast. Sex is the one categorical scale here, and its pair is
 * CVD-separated.
 *
 * The grid and the axis labels sit one shade off the surface, SOLID rather
 * than dashed: a dashed grid competes with the data drawn on top of it.
 */
export const PRIMARY = "#723EC3";

export const GENDER_COLORS: Record<string, string> = {
  Male: "#723EC3",
  Female: "#0EA5A4",
  Other: "#E8892B",
};

export const AXIS = "#9CA3AF";

export const GRID = "#ECEEF3";

export const tooltipStyle = { borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 12 };

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
