/**
 * The census form's rules: which questions a line is asked, and how an answer is read.
 *
 * Pure functions, so they can be tested for what they are.
 */

import { HOME } from "./constants";
import type { Member } from "../types";

/**
 * Q16 says the income did not come from work, so Q17 and Q18 are skipped.
 *
 * Remittance, investments and "others" are money without a job — the paper
 * sends all three straight to Q19. The three codes are named because the
 * paper names them; this list is fixed by the form, not by us.
 */
export function skipsToQ19(member: Member): boolean {
  return ["3", "4", "5"].includes(String(member.q16_income_source ?? ""));
}

/**
 * Q36, which the paper says to work out rather than ask.
 *
 *   Non-migrant  Q33 and Q34 are both this barangay.
 *   Migrant      either is somewhere else, and Q35 is at least six months
 *                and one day.
 *   Transient    either is somewhere else, and Q35 is under six months.
 *
 * The two residences are free text, so "this barangay" is read by name.
 * Anything the form cannot decide it leaves alone — a wrong code here sends
 * eight migration questions to 99 for somebody who should have answered
 * them, which is worse than an empty box.
 */
export function residentTypeFrom(member: Member): string | null {
  const five = String(member.q33_residence_5yrs ?? "").trim();
  const six = String(member.q34_residence_6mos ?? "").trim();

  if (!five || !six) return null;

  const here = (place: string) =>
    new RegExp(HOME.barangay, "i").test(place.replace(/[^A-Za-z0-9 ]/g, " "));

  if (here(five) && here(six)) return "1";

  const years = Number(member.q35_stay_years ?? 0) || 0;
  const months = Number(member.q35_stay_months ?? 0) || 0;

  if (!member.q35_stay_years && !member.q35_stay_months) return null;

  // "At least six months and one day" — six months exactly is still transient.
  return years * 12 + months > 6 ? "2" : "3";
}

/** Q36 says non-migrant, so Q37 to Q41 are not asked of this person. */
export function isNonMigrant(member: Member): boolean {
  return String(member.q36_resident_type ?? residentTypeFrom(member) ?? "") === "1";
}

/**
 * A code already used in the A box cannot be the answer in B as well.
 *
 * Q38 and Q40 each ask for up to three DIFFERENT reasons. Offering the same
 * fifteen in all three boxes is how a form comes back saying somebody left
 * for lack of employment, lack of employment, and lack of employment.
 */
export function without(
  list: Record<string, string> | undefined,
  taken: (string | number | null | undefined)[]
): Record<string, string> {
  const used = taken.filter((v) => v !== null && v !== undefined && v !== "").map(String);

  return Object.fromEntries(
    Object.entries(list ?? {}).filter(([code]) => !used.includes(code))
  );
}

/**
 * Whether the chosen code is the list's "Others" entry.
 *
 * Read from the list itself rather than hard-coded: the code differs per
 * question — 5 for lighting fuel, 6 for cooking, 12 for water, 18 for skills
 * — and a table of magic numbers here would drift from the model that owns
 * them.
 */
export function isOther(value: unknown, list?: Record<string, string>): boolean {
  if (value === null || value === undefined || value === "") return false;

  return /^other/i.test(list?.[String(value)] ?? "");
}

/**
 * One letter, written the way an initial is written.
 *
 * "l", "L" and "L." are the same answer; which of them the register ends up
 * holding should not depend on whether the encoder reached for the full stop.
 * An empty box stays empty — plenty of people have no middle name, and "."
 * on its own is not one.
 */
export function asInitial(typed: string): string {
  const letter = typed.replace(/[^A-Za-zÑñ]/g, "").slice(0, 1).toUpperCase();

  return letter === "" ? "" : `${letter}.`;
}

/**
 * "Dela Cruz, Juan R." into its three parts.
 *
 * The form asks for the head as "Last Name, First Name M.I." and then asks
 * for the same person again on line 1 — the head is always line 1, that is
 * what Q2 code 01 means. Typing the name twice is two chances to spell it
 * differently, and the two spellings then belong to two different people as
 * far as anything reading them is concerned.
 *
 * The comma is what the form itself uses to separate the surname, so it is
 * what is read. Everything after the first comma is given names; the last
 * word of those is taken as the middle initial only when it looks like one —
 * "Juan R." gives R., while "Juan Miguel" is left whole, because a second
 * given name is not an initial.
 */
export function splitHeadName(full: string): { last: string; first: string; middle: string } {
  const [surname, ...rest] = full.split(",");
  const given = rest.join(",").trim();

  if (!given) {
    return { last: surname.trim(), first: "", middle: "" };
  }

  const words = given.split(/\s+/).filter(Boolean);
  const tail = words[words.length - 1] ?? "";

  // An initial: one letter, optionally with a full stop.
  const isInitial = words.length > 1 && /^[A-Za-zÑñ]\.?$/.test(tail);

  return {
    last: surname.trim(),
    first: (isInitial ? words.slice(0, -1) : words).join(" "),
    /*
     * Upper-cased and given its full stop, because line 1 shows it read-only:
     * whatever this returns is what the register carries, and nobody
     * downstream can correct it by hand.
     */
    middle: isInitial ? `${tail.replace(/\.$/, "").toUpperCase()}.` : "",
  };
}

/**
 * Age at last birthday, from a birth month and year.
 *
 * The census asks for a month and a year and no day, so the turn-over is put
 * at the END of the birth month: somebody born in June is 32 for all of June
 * and 33 from July. That is the safe direction to be wrong in — it never
 * makes anybody older than they are, so nobody reaches a senior citizen's
 * entitlement or passes a youth programme's cut-off a month early.
 *
 * Derived rather than typed, so it is right tomorrow as well as today. An age
 * written into a box is a fact about the day it was written.
 */
export function ageFromMonthYear(month: unknown, year: unknown): number | null {
  const m = Number(month);
  const y = Number(year);

  if (!m || !y || m < 1 || m > 12 || y < 1900) return null;

  const now = new Date();
  const monthsElapsed = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);

  // A month and year still ahead of us is a mis-typed line, not a person.
  if (monthsElapsed < 0) return null;

  const age = now.getFullYear() - y - (now.getMonth() + 1 <= m ? 1 : 0);

  /*
   * Clamped, for the newborn. A baby born THIS month has no completed year
   * and comes out of the sum as -1; they are 0, and a blank age box on the
   * one line most likely to need a health visit is the worst place for this
   * to go quiet.
   */
  return Math.max(age, 0);
}

/** Age at last birthday, the way Q4 asks for it. */
export function ageFrom(birthdate?: string | null): number | null {
  if (!birthdate) return null;

  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();

  // "At last birthday" — not yet had it this year means one less.
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;

  return age >= 0 ? age : null;
}

/**
 * Is this box answered?
 *
 * 0 and 99 are answers — "no income" and "does not apply" are both things a
 * household said. Only an empty box is unanswered.
 */
export function answered(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/**
 * How far through a section this line is.
 *
 * The list is written at the call site as the section's own questions, with
 * a conditional one dropped in as `condition && "key"` — so what is counted
 * sits beside what is rendered and the two cannot quietly drift apart.
 *
 * A question this person should not be asked is not counted, in the
 * numerator or the denominator. Counting them would leave every adult stuck
 * at "Infant health 0/5" for good, which reads as broken and is the surest
 * way to teach an encoder to start inventing answers to clear it.
 */
export function progressOf(keys: (string | false | null | undefined)[], member: Member) {
  const asked = keys.filter(Boolean) as string[];

  return {
    total: asked.length,
    filled: asked.filter((key) => answered(member[key])).length,
  };
}

/** The inverse of `outOfBand`: an unknown age cannot be ruled out of anything. */
export function inBand(age: unknown, min: number, max?: number): boolean {
  return !outOfBand(age, min, max);
}

/**
 * How old this line is, as the form should read it.
 *
 * Q5 first, always: a month and a year is what the census collects, and Q4
 * is that arithmetic — which is why Q4 goes read-only the moment Q5 is
 * answered. A read-only box has no onChange, so `q4_age` is never written to
 * state, and every band that asked the box was asking an empty value.
 *
 * The typed number is still the fallback, for a line where the office knows
 * the age and not the birth month.
 */
export function ageOf(member: Member): number | null {
  const derived = ageFromMonthYear(member.q5_birth_month, member.q5_birth_year);
  if (derived !== null) return derived;

  const typed = member.q4_age;
  if (typed === null || typed === undefined || typed === "") return null;

  const n = Number(typed);

  return Number.isNaN(n) ? null : n;
}

/**
 * Family planning is asked of women 10 to 54.
 *
 * An unanswered Q3 counts as applicable. Hiding a whole section because one
 * earlier box is still blank is how a section gets skipped for good.
 */
export function maybeWoman(member: Member, sexes?: Record<string, string>): boolean {
  const label = sexes?.[String(member.q3_sex ?? "")] ?? "";

  return label === "" || /female|babae/i.test(label);
}

/**
 * Are Q13 and Q14 still being asked?
 *
 * The paper prints "FOR 3-24 YEARS OLD" over Q12–Q14 and its notes say to
 * write 99 from twenty-five up. That upper bound is not kept here, because
 * it is not true: people go back to school at any age — ALS, a degree
 * finished late, a senior citizen enrolled — and a locked box would make the
 * form record a 99 that the household would say is wrong.
 *
 * What is kept is Q12's own instruction, printed on the same page: "If No,
 * SKIP to Q15". So Q13 and Q14 follow the answer to Q12 rather than a
 * birthday. That is both what the form says and what is actually so — a
 * person not enrolled has no school level and no place of school, whether
 * they are nine or ninety.
 *
 * An unanswered Q12 leaves them open. A blank box is not a No.
 */
export function schoolDetailsApply(member: Member): boolean {
  if (outOfBand(ageOf(member), 3)) return false;

  const enrolled = String(member.q12_enrolled ?? "");

  return enrolled === "" || enrolled === "1" || enrolled === "2";
}

/** Whether an age puts a question outside the band the form asks it in. */
export function outOfBand(age: unknown, min: number, max?: number): boolean {
  const n = Number(age);
  if (age === null || age === undefined || age === "" || Number.isNaN(n)) return false;

  return n < min || (max !== undefined && n > max);
}
