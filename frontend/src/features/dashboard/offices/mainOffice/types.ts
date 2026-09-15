/**
 * The executive summary the Punong Barangay's dashboard is sent.
 */

/** Punong Barangay executive view payload (module 1.6). */
export interface ExecutiveSummary {
  documents_awaiting_signature: {
    id: number;
    document_type: string;
    document_number: string;
    document_title: string;
    document_date: string;
    creator?: { name: string } | null;
  }[];
  documents_awaiting_count: number;
  /* Retired with the referrals module. Left declared so an older API
     response does not become a type error mid-deploy. */
  referrals_requiring_action?: {
    id: number;
    referral_number: string;
    receiving_office: string;
    followup_date?: string | null;
    status: string;
    resident?: { first_name: string; last_name: string } | null;
  }[];
  referrals_action_count?: number;
  office_workload: Record<string, { pending: number; in_progress: number; total: number }>;
  aging_requests: Record<string, number>;
  oldest_open_request?: {
    request_number: string;
    service_type: string;
    office: string;
    days_open: number;
  } | null;
  frequently_requested: { service_type: string; count: number }[];
  service_statistics: {
    open_requests: number;
    completed_this_month: number;
    certificates_released_this_month: number;
    residents_served_this_month: number;
  };
  recent_directives: {
    id: number;
    document_type: string;
    document_number: string;
    document_title: string;
    document_date: string;
  }[];
  announcements: { id: number; title: string; created_at: string }[];
}

export interface MainOfficeDashboardProps {
  executive?: boolean;
}
