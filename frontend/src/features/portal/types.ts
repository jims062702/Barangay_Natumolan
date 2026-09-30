/**
 * What the resident portal is sent about the resident's own matters.
 */

export interface ServiceGuide {
  id: number;
  office: string;
  service_name: string;
  description: string;
  requirements?: string | null;
  fees?: string | null;
  schedule?: string | null;
  keywords?: string | null;
  is_active: boolean;
}

/** A resident's own case, as the portal shows it. */
export interface PortalKpCase {
  case_number: string;
  title: string;
  classification: string;
  my_role: "Complainant" | "Respondent";
  stage: string;
  date_filed?: string | null;
  date_resolved?: string | null;
  occurred_on?: string | null;
  place?: string | null;
  other_party?: string | null;
  next_hearing?: {
    type: string;
    scheduled_at?: string | null;
    summons_served?: string | null;
  } | null;
  hearings_held: number;
  /*
   * Every sitting on this case, not only the next one — a person summoned to
   * appear is entitled to the whole schedule. Deliberately WITHOUT minutes:
   * what was said in a session is the Punong Barangay's record of it.
   */
  hearings?: {
    type: string;
    scheduled_at?: string | null;
    status: string;
    summons_served?: string | null;
    /* THEIR OWN attendance, worked out by the server from which side they
       are on. Null means the sitting has not been minuted yet — which is
       not the same as "did not attend". */
    i_attended?: boolean | null;
  }[];
  /**
   * What has happened, oldest first — one row per event.
   *
   * Four fields rather than a sentence: `event` is the kind of thing,
   * `status` how it went, `description` the line a person reads. As one
   * string no column could be scanned down.
   */
  history?: {
    on: string;
    event: string;
    status: string;
    description: string;
  }[];
  settlement?: {
    type: string;
    agreed_on?: string | null;
    status: string;
  } | null;
}

/** One certificate type a resident can ask for, with what it takes. */
export interface CertificateService {
  certificate_type: string;
  /*
   * Null where the ordinance prices by purpose rather than by document.
   * A Barangay Clearance is ₱30 for local employment and ₱200 for a Mayor's
   * Permit, so there is no one number to quote — and quoting one would be
   * telling most residents the wrong amount before they walk over.
   */
  fee: number | null;
  fee_varies?: boolean;
  /** "clearance" when priced by purpose, "business" when by kind of business. */
  fee_from?: string | null;
  purposes?: Record<string, number> | null;
  business_kinds?: Record<string, number> | null;
  /** The ordinance's catch-all, for an answer typed under "Others". */
  other_fee?: number;
  /** Added to every certificate. */
  documentary_stamp?: number;
  /** False where the certificate prints no purpose — nothing to ask. */
  asks_purpose?: boolean;
  description?: string | null;
  requirements: string[];
  schedule?: string | null;
}
