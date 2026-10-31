export interface Appointment {
  id: number;
  appointment_number: string;
  resident_id: number | null;
  applicant_type: "Resident" | "Non-resident";
  is_walk_in: boolean;
  full_name: string;
  address: string | null;
  phone_number: string;
  email: string | null;
  appointment_date: string;
  appointment_time: string | null;
  purpose: string;
  status: "Pending" | "Approved" | "Rejected" | "Completed" | "Cancelled";
  minutes: string | null;
  rejection_reason: string | null;
  cancel_reason: string | null;
  id_card_code: string | null;
  id_photo_path: string | null;
  approved_by: number | null;
  approved_at: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  resident?: {
    id: number;
    resident_number: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    suffix: string | null;
    contact_number: string | null;
    email: string | null;
  } | null;
  approver?: {
    id: number;
    name: string;
  } | null;
  canceller?: {
    id: number;
    name: string;
  } | null;
}

