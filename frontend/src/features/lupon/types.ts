/**
 * The Lupon Tagapamayapa docket.
 */

import type { Resident, User } from "../../shared/types";

export interface LuponCase {
  id: number;
  case_number: string;
  case_title: string;
  case_classification: string;
  /** Null when the complainant lives outside the barangay. */
  complainant_id?: number | null;
  complainant_name?: string | null;
  complainant_address?: string | null;
  complainant_contact?: string | null;
  /** Server-computed: the complainant's name whichever kind they are. */
  complainant_display_name?: string;
  complainant_is_resident?: boolean;
  /*
   * Read from the register for a resident, from the case for somebody
   * outside it — so the page never has to ask which kind of complainant
   * it is holding.
   */
  complainant_display_address?: string | null;
  complainant_display_contact?: string | null;
  complainant_reference?: string | null;
  jurisdiction_status: string;
  rejection_reason?: string | null;
  current_stage: string;
  date_filed: string;
  date_resolved?: string | null;
  notes?: string | null;
  complainant?: Resident | null;
  /** Everyone complained against — a KP case may name more than one. */
  respondents?: Resident[];
  /** Server-computed: their names joined, for lists and search. */
  respondent_display_names?: string;
  complaint?: LuponComplaint | null;
  hearings?: LuponHearing[];
  settlement?: LuponSettlement | null;
}

export interface LuponComplaint {
  id: number;
  complaint_narrative: string;
  date_of_occurrence: string;
  place_of_occurrence: string;
  relationship_nature: string;
}

export interface LuponHearing {
  id: number;
  hearing_type: string;
  scheduled_at: string;
  status: string;
  summons_issued: boolean;
  /** Proof of service — required before a party can be defaulted. */
  summons_served_date?: string | null;
  complainant_present?: boolean | null;
  respondent_present?: boolean | null;
  attendance_notes?: string | null;
  proceedings_notes?: string | null;
  outcome?: string | null;
  recorder?: Partial<User> | null;
  lupon_case?: Partial<LuponCase> | null;
}

/** One prescribed DILG KP form, with whether this case can produce it. */
export interface KpForm {
  code: string;
  name: string;
  available: boolean;
  requires: string;
}

export interface KpFormPayload {
  case: LuponCase;
  barangay: { name: string; municipality: string; province: string };
  next_hearing?: LuponHearing | null;
  forms: KpForm[];
}

export interface LuponSettlement {
  id: number;
  settlement_type: string;
  terms: string;
  date_agreed: string;
  repudiation_deadline: string;
  status: string;
  compliance_deadline?: string | null;
  compliance_notes?: string | null;
  cfa_issued: boolean;
  cfa_issued_at?: string | null;
  cba_issued: boolean;
  cba_issued_at?: string | null;
  closed_at?: string | null;
  recorder?: Partial<User> | null;
  lupon_case?: Partial<LuponCase> | null;
}
