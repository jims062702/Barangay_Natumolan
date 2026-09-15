/**
 * What a certificate form asks, what it calls each answer, and in what order.
 */

import type { Resident } from "../../../shared/types";

/** The plain-language label for each extra question a form asks. */
/**
 * What the register can already answer, so the clerk is not asked for it.
 *
 * Only Q35 so far — how long they have lived here. It is the one thing on
 * these forms the barangay has actually written down somewhere, it is asked
 * once at the census and never again, and the Certificate of Residency
 * prints it. Leaving the box empty meant a clerk either guessed or left a
 * blank line on a signed document.
 *
 * A prefill, not a lock: it fills the input, and the clerk can type over it
 * for somebody who moved last year.
 */
export function fromRegister(resident: Resident | null): Record<string, string> {
  const years = resident?.length_of_residence_years;

  return years === null || years === undefined ? {} : { years_of_residence: String(years) };
}

export const FIELD_LABELS: Record<string, string> = {
  or_number: "OR number",
  officer_of_the_day: "Kagawad — officer of the day",
  business_name: "Business name",
  business_kind: "Kind of business",
  years_of_residence: "Years at this address",
  father_name: "Father's name",
  mother_name: "Mother's name",
  deceased_name: "Name of the deceased",
  deceased_age: "Age at death",
  deceased_address: "Address of the deceased",
  date_of_death: "Date of death",
  time_of_death: "Time of death",
  place_of_death: "Place of death",
  requested_by: "Requested by",
  relationship_to_deceased: "Their relationship to the deceased",
  position: "Position",
  station: "Station",
  dates_appeared: "Date/s appeared",
  partner_name: "Common law partner's name",
  years_together: "Years together",
  name_on_payroll: "Name as it appears on the payroll",
  correct_name: "The correct spelling",
  civil_status_stated: "Civil status to state",
  late_spouse_name: "Name of the late spouse",
  attached_documents: "Documents attached",
  applicant_name: "Applicant or company",
  work_applied_for: "Work applied for",
  body: "What this certifies",
};

/*
 * Asked after the purpose, because that is where the sheet prints them: the
 * kagawad's line and the OR number sit at the foot of the clearance. Every
 * other question comes before the purpose, which is the last blank in the
 * body of every form that has one.
 */
export const AFTER_PURPOSE = new Set(["officer_of_the_day", "or_number"]);

/** A hint only where the answer's shape is not obvious from the label. */
export const FIELD_HINTS: Record<string, string> = {
  time_of_death: "Written as it should print — e.g. 3:00 o'clock in the afternoon",
  relationship_to_deceased: "e.g. his son, her daughter — this prints as written",
  work_applied_for: "e.g. ELECTRICAL INSTALLATION, FENCE, HOUSE EXTENSION",
  attached_documents: "e.g. Church and Barangay Certifications of Death",
  years_of_residence: "From the RBIM census (Q35). Type over it if it is out of date.",
};

// Map a requested service to a certificate type the catalogue knows.
export function toCertType(serviceType: string, known: string[]): string {
  if (serviceType === "First-Time Jobseeker Certification") return "First-Time Jobseeker";

  return known.includes(serviceType) ? serviceType : "Other Certification";
}
