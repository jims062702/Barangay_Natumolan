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
  /** The filing fee's own state — Unpaid, Paid, Overdue — kept apart from the stage. */
  payment_status?: "Unpaid" | "Paid" | "Overdue" | null;
  payment_required_at?: string | null;
  /** The end of the third calendar day after filing, in Manila. */
  payment_due_at?: string | null;
  /** When the system closed it for the fee not paid. */
  auto_closed_at?: string | null;
  date_filed: string;
  date_resolved?: string | null;
  /** Why it was withdrawn, or what the certification to court rests on. */
  closure_reason?: string | null;
  notes?: string | null;
  complainant?: Resident | null;
  /** Everyone complained against — a KP case may name more than one. */
  respondents?: Resident[];
  /** Server-computed: their names joined, for lists and search. */
  respondent_display_names?: string;
  complaint?: LuponComplaint | null;
  /*
   * Sent by the print register only: which papers this case's stage calls
   * for, and whether they have been printed. The register keeps a case
   * after it is printed — its whole job is answering "has the notice of
   * hearing and the summons gone out?" — so every row needs to say which.
   */
  papers_for?: "Mediation" | "Conciliation";
  papers_printed_at?: string | null;
  papers_hearing_id?: number | null;
  hearings?: LuponHearing[];
  settlement?: LuponSettlement | null;
  /* The fees on the case: the Lupon asks, the Clerk takes. */
  payments?: {
    id: number;
    kind: "Filing";
    label: string;
    amount: string;
    stamp_amount: string;
    total: string;
    status: "Requested" | "Paid" | "Cancelled";
    paid_at: string | null;
    receipt_no: string | null;
  }[];
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
  /**
   * When the appointment is EXPECTED to be over: ninety minutes on.
   *
   * A default for laying out the day, not a deadline. Nothing ends,
   * cancels or completes a sitting when it passes, and it is never
   * printed on a summons — a party who read an end time on the paper and
   * left at that hour would have walked out of their own case.
   */
  scheduled_end_at?: string | null;
  /** The appointment runs past the hour the hall closes: pick another. */
  past_closing?: boolean;
  /** When it ACTUALLY ran, which is not when it was set to. */
  started_at?: string | null;
  ended_at?: string | null;
  /**
   * How far behind this sitting starts, because the one before it overran.
   *
   * The appointment itself is untouched — the summons in a party's hand
   * names an hour, and a system that quietly moved it would tell them one
   * thing and the hall another. This is the office reading the day as it
   * actually stands.
   */
  delayed_minutes?: number;
  status: string;
  summons_issued: boolean;
  /** When the Secretary printed it — the moment the parties were told. */
  summons_printed_at?: string | null;
  /** Proof of service — required before a party can be defaulted. */
  summons_served_date?: string | null;
  complainant_present?: boolean | null;
  respondent_present?: boolean | null;
  attendance_notes?: string | null;
  proceedings_notes?: string | null;
  outcome?: string | null;
  recorder?: Partial<User> | null;
  /**
   * Is this the third of the three sittings of its kind?
   *
   * Sent only by the sitting's own screen, which is the one place that has
   * to say what recording it will DO: on the last Tuesday, "the case stays
   * where it is" is untrue — it goes to the Lupon.
   */
  last_of_stage?: boolean;
  /**
   * What came of this sitting, as the calendar says it — "Completed ·
   * Settled", "Completed · Move to Lupon", "Completed · Not settled".
   *
   * Sent by the calendar only, and worked out on the server: a month is a
   * window, so the sitting that ended a case's mediation may be in this
   * month while the two before it are in the last. The page cannot count
   * what it cannot see.
   */
  result_label?: string | null;
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
  /** Who signs the paper — the roster's names, correctable before printing. */
  signatories?: Record<string, string | null>;
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
  closed_at?: string | null;
  recorder?: Partial<User> | null;
  lupon_case?: Partial<LuponCase> | null;
}

/**
 * A complaint begun on the website or in the portal, before it is a case.
 *
 * `reference_no` is an ONLINE COMPLAINT REFERENCE NUMBER — OC-2026-0007 —
 * and it is not a case number. `lupon_case` is null until the Lupon presses
 * Accept at the counter, and that is the one moment the two are connected.
 */
export interface OnlineComplaint {
  id: number;
  reference_no: string;
  filer_kind: "Resident" | "Non-resident";
  status: "For Office Verification" | "Accepted" | "Rejected" | "Withdrawn";
  complainant_name: string;
  complainant_address: string;
  complainant_contact: string;
  respondent_name: string;
  respondent_address?: string | null;
  narrative: string;
  date_of_occurrence?: string | null;
  place_of_occurrence?: string | null;
  relationship_nature?: string | null;
  /** Nature of the Case, as the complainant chose it (the case's own, once accepted, is on lupon_case). */
  case_classification?: string | null;
  valid_id_type: string;
  valid_id_number?: string | null;
  created_at: string;
  office_notes?: string | null;
  handled_at?: string | null;
  /** Set when the filer was found on the register. */
  resident?: { id: number; first_name: string; middle_name?: string | null; last_name: string } | null;
  lupon_case?: { id: number; case_number: string; case_classification?: string | null; current_stage?: string } | null;
  files?: OnlineComplaintFile[];
}

export interface OnlineComplaintFile {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

