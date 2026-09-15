/**
 * What a box on the census form does to what is typed into it.
 */

/**
 * A whole number, capped by the code rather than by the browser.
 *
 * `maxLength` does nothing at all on `<input type="number">` — which is why
 * a three-digit age box happily took seven digits. So numeric boxes are text
 * boxes in numeric mode, and the cap is applied where it can be trusted.
 */
export function onlyDigits(raw: unknown, cap: number): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, cap);
}

/** 5000 into 5,000. Below a thousand there is nothing to group. */
export function groupThousands(raw: unknown): string {
  // A decimal column reads back as "5000.00"; the pesos are what was typed.
  const whole = String(raw ?? "").split(".")[0].replace(/\D/g, "");

  return whole === "" ? "" : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** MM/YYYY, with the slash put in as it is typed. */
export function maskMonthYear(raw: string): string {
  const only = raw.replace(/\D/g, "").slice(0, 6);

  return only.length <= 2 ? only : `${only.slice(0, 2)}/${only.slice(2)}`;
}

/** Two columns — a month and a year — read as one box. */
export function joinMonthYear(month: unknown, year: unknown): string {
  const m = month === null || month === undefined || month === "" ? "" : String(month);
  const y = year === null || year === undefined || year === "" ? "" : String(year);

  if (!m && !y) return "";
  if (!y) return m.padStart(2, "0");

  return `${m.padStart(2, "0")}/${y}`;
}

export function splitMonthYear(text: string): { month: string; year: string } {
  const only = text.replace(/\D/g, "");
  const month = only.slice(0, 2);

  return {
    // A month of 00 is nobody's month; it is half of a keystroke.
    month: month === "" || Number(month) === 0 ? "" : String(Number(month)),
    year: only.slice(2, 6),
  };
}
