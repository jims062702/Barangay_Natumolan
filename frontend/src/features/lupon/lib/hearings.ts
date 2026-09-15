/**
 * What the hearing calendar offers, and how it reads a hearing.
 */

import type { LuponHearing } from "../types";

export const HEARING_TYPES = ["Mediation", "Conciliation", "Arbitration"];

export const OUTCOME_STATUSES = ["Completed", "Rescheduled", "Cancelled", "No Show"];

export const today = () => new Date().toISOString().slice(0, 10);

export const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

/** Scheduled, summons issued, but no proof of service on file. */
export const unserved = (h: LuponHearing) =>
  h.status === "Scheduled" && !h.summons_served_date;

export type View = "today" | "upcoming" | "past";
