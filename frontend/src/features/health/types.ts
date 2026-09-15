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

export interface ImmunizationRecord {
  id: number;
  child_id: number;
  vaccine_name: string;
  vaccination_date: string;
  scheduled_date?: string | null;
  status: string;
  child?: Resident | null;
}

export interface MaternalRecord {
  id: number;
  mother_id: number;
  pregnancy_registration_date: string;
  expected_delivery_date?: string | null;
  prenatal_visits_count: number;
  risk_indicators?: string | null;
  status: string;
  mother?: Resident | null;
}

export interface ChildHealthRecord {
  id: number;
  child_id: number;
  birth_date: string;
  current_weight?: number | string | null;
  current_height?: number | string | null;
  nutritional_status?: string | null;
  child?: Resident | null;
}
