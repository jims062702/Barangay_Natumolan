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
  /** Victim-Survivor, Parent/Guardian, Relative, … — who reported it. */
  reported_by_type?: string | null;
  /** Who brought the complaint, when that is not the survivor herself. */
  reported_by_name?: string | null;
  reported_by_resident_id?: number | null;
  reported_by_relationship?: string | null;
  reported_by_contact?: string | null;
  /** Item 9: on what authority somebody files for another person. */
  applicant_consent?: string | null;
  /*
   * Item 4 of the protection-order application: who it is against.
   *
   * Always a resident of this barangay, so always a register id — an order
   * can only be issued against somebody the Punong Barangay has power over.
   * Everything else item 4 asks for is read off `respondent`.
   */
  respondent_id?: number | null;
  respondent?: Resident | null;
  violence_type: string;
  /*
   * Every kind this case is, and the acts under them the desk noted.
   *
   * `violence_type` above is the one-word summary the quarterly forms read,
   * kept in step with this list by the server ("Mixed" when there is more
   * than one). A case filed before the list existed carries only the word.
   */
  violence_types?: string[] | null;
  violence_acts?: string[] | null;
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
  /** The immediate safety assessment. */
  currently_in_danger?: "Yes" | "No" | "Unknown" | null;
  protection_needed?: "Yes" | "No" | null;
  survivor?: Resident | null;
  officer?: User | null;
  incidents?: VawcIncident[];
  referrals?: VawcReferral[];
  followups?: VawcFollowup[];
  documents?: VawcDocument[];
  /** Every BPO on the case, newest first. */
  protection_orders?: VawcProtectionOrder[];
  assessment?: VawcAssessment | null;
  child_welfare?: VawcChildWelfare | null;
  /** The one dialogue, when there was one. */
  agreement?: VawcDialogue | null;
}

/**
 * A Barangay Protection Order. In effect fifteen days from issuance; a
 * renewal is its own row pointing at the one it renews.
 */
export interface VawcProtectionOrder {
  id: number;
  renewal_of_id?: number | null;
  status: string;
  bpo_number?: string | null;
  applied_on?: string | null;
  issued_on?: string | null;
  /** The last day in effect — worked out by the server, never typed. */
  expires_on?: string | null;
  issued_by?: string | null;
  issued_by_name?: string | null;
  notes?: string | null;
  in_effect: boolean;
  days_left?: number | null;
  recorder?: Partial<User> | null;
  created_at?: string;
}

export interface VawcAssessment {
  id: number;
  assessment_date: string;
  persons_present: string[] | null;
  statement?: string | null;
  observations?: string | null;
  services_provided: string[] | null;
  action_plan?: string | null;
  next_followup_date?: string | null;
  informed_of_rights: boolean;
  protection_order_offered: boolean;
  referral_made: boolean;
  next_steps_documented: boolean;
  recorder?: Partial<User> | null;
  updated_at?: string;
}

export interface VawcChildDetail {
  resident_id: number;
  /** The name when saved, so the row reads even if the record is merged away. */
  name: string;
  relationship?: string | null;
  caregiver?: string | null;
  living_arrangement?: string | null;
  immediate_needs?: string | null;
}

export interface VawcChildWelfare {
  id: number;
  children: VawcChildDetail[] | null;
  support_needed?: "Yes" | "No" | "Unknown" | null;
  support_types: string[] | null;
  current_support?: string | null;
  referral_needed: string[] | null;
  referral_other?: string | null;
  notes?: string | null;
  recorder?: Partial<User> | null;
  updated_at?: string;
}

/** The one optional dialogue, and whether it ended in agreement. */
export interface VawcDialogue {
  id: number;
  session_date: string;
  attendees: string | null;
  discussion: string | null;
  outcome: "Agreement reached" | "Not settled" | "No agreement" | null;
  agreement: string | null;
  recorder?: Partial<User> | null;
}

export interface VawcIncident {
  id: number;
  /*
   * When and where it happened.
   *
   * Both were asked for at intake and both were stored — and neither was
   * declared here, so nothing on the desk could read them and no screen
   * showed them. A VAWC officer picking up a case could not tell whether
   * the act was last night or last year, which is the first thing that
   * decides what to do about it.
   */
  occurred_at?: string | null;
  /** "Around 8:00 PM" — in words, when the exact time is not known. */
  approximate_time?: string | null;
  location?: string | null;
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
  /** The destination — a listed one, or the office's name typed under Other. */
  referral_agency: string;
  referral_reason?: string | null;
  reason_other?: string | null;
  urgency: string;
  referral_status: string;
  notes?: string | null;
  referrer?: Partial<User> | null;
  receiving_person?: string | null;
  services_requested?: string | null;
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
  /** The method: In Person, Phone, Home Visit, … */
  followup_type: string;
  conducted_by?: string | null;
  safety_status: string;
  protection_order_status: string;
  referral_attended?: boolean | null;
  services_received?: string | null;
  new_incident?: boolean | null;
  additional_needs?: string | null;
  next_action?: string | null;
  notes?: string | null;
  next_followup_date?: string | null;
  closure_recommended: boolean;
  recorder?: User | null;
  vawc_case?: VawcCaseRef | null;
}

export interface VawcDocument {
  id: number;
  document_type: string;
  document_date?: string | null;
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
