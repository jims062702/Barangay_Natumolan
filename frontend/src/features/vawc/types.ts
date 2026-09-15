/**
 * The VAWC desk's records. Confidential: never cached, never queued.
 */

import type { Resident, User } from "../../shared/types";

export interface VawcCase {
  id: number;
  case_code: string;
  survivor_id: number;
  /**
   * How urgent the case is, in words. Null means nobody has judged it yet —
   * which is its own state, and not the same as safe.
   *
   * Set at intake and re-stated by every follow-up, so the docket shows what
   * was last seen rather than what was first assumed.
   */
  risk_level?: "Critical" | "High" | "Medium" | "Low" | null;
  risk_assessed_at?: string | null;
  /** How the complaint reached the barangay. */
  reporting_channel?: string | null;
  /** Sent with the list: the soonest visit due, and the last one made. */
  next_followup_date?: string | null;
  last_followup_date?: string | null;
  /** Who brought the complaint, when that is not the survivor herself. */
  reported_by_name?: string | null;
  reported_by_relationship?: string | null;
  reported_by_contact?: string | null;
  violence_type: string;
  relationship_to_offender?: string | null;
  children_involved: boolean;
  children_count: number;
  /** Children/dependents involved, linked to their registry records. */
  dependents?: Resident[];
  children_details?: string | null;
  immediate_needs?: string | null;
  previous_incidents_count: number;
  status: string;
  confidential_notes?: string | null;
  report_date: string;
  survivor?: Resident | null;
  officer?: User | null;
  incidents?: VawcIncident[];
  referrals?: VawcReferral[];
  followups?: VawcFollowup[];
  documents?: VawcDocument[];
}

export interface VawcIncident {
  id: number;
  incident_narrative: string;
  injury_documentation?: string | null;
  medical_certificate_reference?: string | null;
  police_report_reference?: string | null;
  protection_order_filed: boolean;
  created_at?: string;
}

/**
 * `vawc_case` is present on the desk-wide worklists (referrals, follow-ups,
 * documents) and carries the case CODE only — never the survivor's name.
 */
export interface VawcCaseRef {
  id: number;
  case_code: string;
  violence_type?: string;
  status?: string;
}

export interface VawcReferral {
  id: number;
  referral_agency: string;
  receiving_person?: string | null;
  services_requested: string;
  referral_date: string;
  acknowledgment_date?: string | null;
  outcome?: string | null;
  followup_schedule?: string | null;
  is_completed: boolean;
  vawc_case?: VawcCaseRef | null;
}

export interface VawcFollowup {
  id: number;
  followup_date: string;
  followup_type: string;
  safety_status: string;
  bpo_compliance: string;
  referral_attended?: boolean | null;
  services_received?: string | null;
  notes?: string | null;
  next_followup_date?: string | null;
  closure_recommended: boolean;
  recorder?: User | null;
  vawc_case?: VawcCaseRef | null;
}

export interface VawcDocument {
  id: number;
  document_type: string;
  title: string;
  description?: string | null;
  file_reference?: string | null;
  uploader?: User | null;
  created_at?: string;
  vawc_case?: VawcCaseRef | null;
}

/** One entry in the confidential access trail. */
export interface VawcAccessLog {
  id: number;
  action: string;
  detail?: string | null;
  created_at: string;
  user?: Partial<User> | null;
  vawc_case?: VawcCaseRef | null;
}
