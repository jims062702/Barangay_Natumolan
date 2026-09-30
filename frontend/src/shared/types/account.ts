/**
 * Accounts — the signed-in user and what the system tells them.
 */

import type { Resident } from "./resident";

/** Shared API models — mirror the Laravel backend responses. */

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  office: string;
  is_active?: boolean;
  /**
   * Null until the account holder has entered the code emailed to them.
   * Distinct from `is_active`, which is the office switching a login off.
   */
  activated_at?: string | null;
  resident_id?: number | null;
  resident?: Resident | null;
}

export interface AppNotification {
  id: number;
  notification_type: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  /** The page the notice is about — the bell opens it. Null: it leads nowhere. */
  link?: string | null;
}
