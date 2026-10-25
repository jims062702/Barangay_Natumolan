/**
 * Requests and certificates — used by the counter, the
 * portal and the dashboards alike.
 */

import type { User } from "./account";
import type { Resident } from "./resident";

export interface ServiceRequest {
  id: number;
  request_number: string;
  /** Shared by the certificates asked for in one visit — TX- and ten hex digits. */
  transaction_code?: string | null;
  resident_id?: number | null;
  service_type: string;
  office: string;
  request_type: string;
  status: string;
  purpose?: string | null;
  assigned_to?: number | null;
  completed_at?: string | null;
  created_at?: string;
  resident?: Resident | null;
  assigned_user?: User | null;
  certificate?: Certificate | null;
}

/**
 * Somebody the Population Office has not listed yet, as the clerk typed them
 * at the counter — only what that certificate prints about them.
 */
export interface UnlistedPerson {
  last_name?: string;
  first_name?: string;
  middle_name?: string | null;
  suffix?: string | null;
  zone_purok?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  birth_place?: string | null;
  civil_status?: string | null;
  address?: string | null;
}

export interface Certificate {
  id: number;
  certificate_number: string;
  /** Null for somebody not yet listed — see unlisted_person. */
  resident_id: number | null;
  unlisted_person?: UnlistedPerson | null;
  service_request_id: number;
  /**
   * Just enough of the request behind it to say how it was asked for.
   *
   * Sent with the list because it decides what the clerk does with a
   * finished certificate: somebody who walked in expects a call, and
   * somebody who asked online may never open their portal to learn it is
   * ready.
   */
  service_request?: { id: number; request_type: "Walk-in" | "Online"; transaction_code?: string | null } | null;
  /** How many certificates the visit asked for, when it asked for several. */
  transaction_size?: number | null;
  certificate_type: string;
  purpose?: string | null;
  /* What the printed form asks for and the register does not know — the hour
     of a death, a partner's name, the work applied for. Keys differ per type;
     CertificateCatalogue on the server says which each one expects. */
  template_fields?: Record<string, string> | null;
  /* The counter photograph, on the clearance that prints one. */
  photo_url?: string | null;
  /** Documentary requirements and whether each was presented at filing. */
  requirements_checklist?: { item: string; presented: boolean }[] | null;
  fee_amount: string | number;
  /** The barangay's documentary stamp, charged on top of the fee. 0 on
      certificates issued before the stamp was charged. */
  documentary_stamp?: string | number;
  /** fee_amount + documentary_stamp — what the resident actually pays. */
  total_amount?: string | number;
  is_exempt: boolean;
  exemption_reason?: string | null;
  /**
   * Pending | Processing | Printed | For Signature | Ready to Claim |
   * Released, plus Cancelled. There is no approval state: the clerk moves the
   * document, nobody decides on it.
   */
  status: string;
  cancel_reason?: string | null;
  reason_for_cancellation?: string | null;
  reference_number: string;
  processed_at?: string | null;
  printed_at?: string | null;
  signed_at?: string | null;
  ready_at?: string | null;
  claimed_at?: string | null;
  released_at?: string | null;
  created_at?: string;
  resident?: Resident | null;
  processor?: Partial<User> | null;
  signer?: Partial<User> | null;
  releaser?: Partial<User> | null;
}
