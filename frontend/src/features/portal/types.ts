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
  settlement?: {
    type: string;
    agreed_on?: string | null;
    status: string;
    certificate_to_file_action: boolean;
  } | null;
}

/** A blotter entry as the resident sees it — no narrative, by design. */
export interface PortalBlotter {
  blotter_number: string;
  recorded_at?: string | null;
  incident_at?: string | null;
  incident_type: string;
  place: string;
  my_role: string;
  action_taken: string;
  status: string;
}

/** One certificate type a resident can ask for, with what it takes. */
export interface CertificateService {
  certificate_type: string;
  /*
   * Null where the ordinance prices by purpose rather than by document.
   * A Barangay Clearance is ₱20 for a filing fee and ₱200 for a Mayor's
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
