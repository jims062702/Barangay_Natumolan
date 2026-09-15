/**
 * How a person on a family card is named, aged and dated.
 */

import type { FamilyMember } from "../../../../shared/types";

/** "January 2019" — a care arrangement is remembered by month, not by day. */
export function monthYear(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Whole-year age, so a card can say "Miguel · 4 yrs" without a round trip. */
export function ageOf(member: FamilyMember): number | null {
  if (member.age != null) return member.age;
  if (!member.birthdate) return null;
  const b = new Date(member.birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function memberName(member: FamilyMember): string {
  if (member.full_name) return member.full_name;
  return [member.first_name, member.middle_name, member.last_name, member.suffix]
    .filter(Boolean)
    .join(" ");
}
