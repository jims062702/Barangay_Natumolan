/**
 * Barangay Health Station records.
 */

import type { Resident, User } from "../../shared/types";

export interface HealthVisit {
  id: number;
  patient_id: number;
  visit_date: string;
  visit_reason: string;
  temperature?: number | string | null;
  blood_pressure?: string | null;
  heart_rate?: number | null;
  symptoms?: string | null;
  treatment_advice?: string | null;
  followup_schedule?: string | null;
  referral_recommended: boolean;
  patient?: Resident | null;
  provider?: User | null;
}

/** One dose, given on one day. */
export interface ImmunizationRecord {
  id: number;
  child_id: number;
  vaccine_name: string;
  vaccination_date: string;
  child?: Resident | null;
}

/**
 * One person's immunization record, laid out as the DOH Individual Treatment
 * Record lays it out: the once-only facts, then a date per vaccine.
 */
export interface ImmunizationCard {
  /* Read from the register, never asked for on the card. */
  resident: {
    id: number;
    resident_number?: string | null;
    full_name: string;
    zone_purok?: string | null;
    gender?: string | null;
    birthdate?: string | null;
    address?: string | null;
  };
  profile: {
    newborn_screening_date?: string | null;
    delivery_type?: "NSVD" | "Cesarian" | null;
    birth_weight_kg?: string | null;
    birth_length_cm?: string | null;
    others?: string | null;
    booster?: string | null;
  } | null;
  /** Vaccine name to the date it was given. */
  doses: Record<string, string>;
  child_vaccines: string[];
  adult_vaccines: string[];
  delivery_types: string[];
}

/* ------------------------------------------------------------------
 | Child Health & Nutrition
 * ---------------------------------------------------------------- */

/** A person as the Population Office's register has them, read for a health page. */
export interface RegisterPerson {
  id: number;
  name: string;
  resident_number?: string | null;
  sex: "Male" | "Female" | null;
  birthdate: string | null;
  age: number | null;
  zone_purok?: string | null;
  address?: string | null;
  contact_number?: string | null;
  deceased: boolean;
}

/** One weighing, as the records list shows it — the child and parents from the register. */
export interface ChildRecordRow {
  id: number;
  child_id: number;
  record_date: string;
  current_weight?: string | null;
  current_height?: string | null;
  nutritional_status?: string | null;
  child_name: string;
  child_resident_number?: string | null;
  birth_date?: string | null;
  sex?: "Male" | "Female" | null;
  zone_purok?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
}

export interface ChildMeasurement {
  id: number;
  record_date: string;
  current_weight?: string | null;
  current_height?: string | null;
  nutritional_status?: string | null;
  /** When it was last saved — an edit's draft is typed against this. */
  version?: string | null;
}

/** A mother and the children the register lists as hers, each with their father. */
export interface MotherChildren {
  mother: RegisterPerson;
  children: (RegisterPerson & {
    father: RegisterPerson | null;
    records: number;
    last_record: string | null;
  })[];
}

/** One child's record: who they are and their parents (the register), and every weighing. */
export interface ChildHistory {
  child: RegisterPerson;
  mother: RegisterPerson | null;
  father: RegisterPerson | null;
  /** From the register: Yes, No, or not said. */
  father_is_current_spouse: boolean | null;
  records: ChildMeasurement[];
}

/* ------------------------------------------------------------------
 | Maternal Health — one record per pregnancy
 * ---------------------------------------------------------------- */

export type PregnancyStatus = "Active" | "Delivered" | "Closed";

export interface PregnancyRow {
  id: number;
  pregnancy_number: number;
  mother_id: number;
  mother_name: string;
  mother_resident_number?: string | null;
  /** Her age when the pregnancy was registered — from the register. */
  mother_age?: number | null;
  zone_purok?: string | null;
  contact_number?: string | null;
  pregnancy_registration_date: string;
  lmp?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  status: PregnancyStatus;
  completed_at?: string | null;
  /** Every prenatal record of this pregnancy. */
  prenatal_visits: number;
  /** The same, while it is current; 0 once it is completed. */
  current_prenatal_visits: number;
  last_visit_date?: string | null;
  /** When it was last saved — an edit's draft is typed against this. */
  version?: string | null;
  /* On the mother's page only. */
  risk_indicators?: string | null;
  referral_to_hospital?: boolean;
  referral_reason?: string | null;
  closure_note?: string | null;
  completed_by?: string | null;
}

export interface PrenatalLine {
  id: number;
  visit_number: number | null;
  visit_date: string;
  zone_purok?: string | null;
  age?: number | null;
  weight_kg?: string | null;
  blood_pressure?: string | null;
  height_cm?: string | null;
  lmp?: string | null;
  edc?: string | null;
  months_of_pregnancy?: string | null;
  contact_number?: string | null;
  complaint?: string | null;
  recorded_by?: string | null;
  version?: string | null;
}

/** The mother's page: her current pregnancy, every pregnancy, and one's prenatal records. */
export interface MotherView {
  /** As the register has her today. */
  mother: {
    id: number;
    name: string;
    resident_number?: string | null;
    birthdate?: string | null;
    age?: number | null;
    address?: string | null;
    zone_purok?: string | null;
    contact_number?: string | null;
    deceased?: boolean;
  };
  current: PregnancyRow | null;
  selected: PregnancyRow | null;
  pregnancies: PregnancyRow[];
  next_pregnancy_number: number;
  visits?: PrenatalLine[];
}

/* ------------------------------------------------------------------
 | Prenatal Records
 * ---------------------------------------------------------------- */

export interface PrenatalRow extends PrenatalLine {
  pregnancy_id: number;
  pregnancy_number: number;
  pregnancy_status: PregnancyStatus;
  pregnancy_visits: number;
  current_prenatal_visits: number;
  mother_id: number | null;
  mother_name: string;
  mother_resident_number?: string | null;
}

/** A pregnancy as the "Current Pregnancy" card shows it, counted again after a save. */
export interface PregnancySummary {
  id: number;
  pregnancy_number: number;
  status: PregnancyStatus;
  prenatal_visits: number;
  current_prenatal_visits: number;
  last_visit_date?: string | null;
  lmp?: string | null;
  expected_delivery_date?: string | null;
}

export interface PrenatalSaved {
  record: PrenatalRow;
  pregnancy: PregnancySummary;
  previous_pregnancy?: PregnancySummary;
}

/* ------------------------------------------------------------------
 | Reports
 * ---------------------------------------------------------------- */

export type RecordKind = "child" | "maternal" | "prenatal";

export interface HealthReport {
  kind: RecordKind;
  period: "monthly" | "yearly";
  title: string;
  barangay: string;
  year: number;
  month: number | null;
  period_label: string;
  zone_purok: string | null;
  zone_label: string;
  generated_at: string;
  total: number;
  columns?: { key: string; label: string }[];
  rows?: Record<string, string | number | null>[];
  months?: { month: number; label: string; total: number }[];
  summaries: { title: string; label: string; rows: { label: string; total: number }[] }[];
}

export interface RecordsSummary {
  year: number;
  month: number;
  child_records: number;
  child_records_this_year: number;
  maternal_records: number;
  maternal_records_this_year: number;
  active_pregnancies: number;
  current_prenatal_visits: number;
  prenatal_records_this_month: number;
  prenatal_records_this_year: number;
}
