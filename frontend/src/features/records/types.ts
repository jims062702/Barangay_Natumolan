/**
 * The barangay's document archive.
 */

import type { User } from "../../shared/types";

/** Ordinance, resolution, minutes… — the barangay's document archive. */
export interface AdministrativeRecord {
  id: number;
  document_type: string;
  document_number: string;
  document_title: string;
  document_date: string;
  document_content: string;
  summary?: string | null;
  file_reference?: string | null;
  is_archived: boolean;
  approved_at?: string | null;
  creator?: Partial<User> | null;
  approver?: Partial<User> | null;
}
