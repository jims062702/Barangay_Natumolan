/**
 * The small pieces of wording every certificate shares: names, dates, blanks.
 */

import type { PrintableCertificate } from "./types";

export const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/** 1ST, 2ND, 3RD, 4TH — the form writes the day as an ordinal. */
export function ordinal(day: number): string {
  if (day > 3 && day < 21) return `${day}TH`;
  switch (day % 10) {
    case 1: return `${day}ST`;
    case 2: return `${day}ND`;
    case 3: return `${day}RD`;
    default: return `${day}TH`;
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** An answer the office gave, or the blank line the paper form would show. */
export function filled(value: unknown, width = "220px"): string {
  const text = String(value ?? "").trim();

  return text
    ? `<u class="ans">${escapeHtml(text)}</u>`
    : `<span class="blank" style="min-width:${width}"></span>`;
}

export function fullName(certificate: PrintableCertificate): string {
  const r = certificate.resident;

  return [r?.first_name, r?.middle_name, r?.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

export function longDate(value?: string | null): string {
  if (!value) return "";

  /* A bare date is three numbers, not an instant — split, never parsed as
     UTC, or a zone behind it would print the day before. */
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).slice(0, 10));

  if (bare) {
    return `${MONTHS[Number(bare[2]) - 1]} ${Number(bare[3])}, ${bare[1]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * A resident's birthdate as precisely as the register knows it.
 *
 * The census asks for a month and a year; the register stores the last day of
 * that month only so the age comes out right. Printed as a date, a certificate
 * stated "JUNE 30, 2002" — a birthday nobody gave. So it prints "JUNE 2002".
 */
export function birthdateLine(r: PrintableCertificate["resident"]): string {
  if (!r?.birthdate) return "";

  if (r.birthdate_is_estimated) {
    const [year, month] = String(r.birthdate).slice(0, 10).split("-").map(Number);

    return year && month ? `${MONTHS[month - 1]} ${year}` : "";
  }

  return longDate(r.birthdate);
}

/**
 * "Given this 9TH day of SEPTEMBER, 2026" — built from the issue date.
 *
 * The Word templates have 2026 typed into them. Left alone, every
 * certificate printed next year would have said 2026.
 */
export function givenThis(verb: string, on: Date): string {
  return `${verb} this <u class="ans">${ordinal(on.getDate())}</u> day of
    <u class="ans">${MONTHS[on.getMonth()]}, ${on.getFullYear()}</u>`;
}
