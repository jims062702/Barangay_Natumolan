/**
 * Population Office records.
 */

import type { Resident, User } from "../../shared/types";

export interface PopulationEvent {
  id: number;
  event_type: string;
  event_date: string;
  description?: string | null;
  verification_status: string;
  resident?: Resident | null;
  recorder?: User | null;
}
