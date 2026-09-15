/**
 * The barangay and SK officials shown on the landing page.
 */

export interface Official {
  id: number;
  group: "Barangay" | "SK";
  position: string;
  name: string;
  term?: string | null;
  photo_path?: string | null;
  photo_url?: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Attendee {
  id?: number;
  name: string;
  position: string | null;
  attendance: "Present" | "Absent" | "Excused" | "Late";
  remarks: string | null;
}

export interface Session {
  id: number;
  session_number: string;
  session_type: "Regular" | "Special";
  session_date: string;
  called_to_order_at: string | null;
  adjourned_at: string | null;
  venue: string;
  agenda: string | null;
  minutes: string | null;
  status: "Draft" | "For Approval" | "Adopted";
  adopted_at: string | null;
  attendees?: Attendee[];
  attendees_count?: number;
  present_count?: number;
  recorder?: { id: number; name: string } | null;
}
