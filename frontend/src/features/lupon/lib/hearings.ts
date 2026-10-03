/**
 * What the hearing calendar offers, and how it reads a hearing.
 */

import type { User } from "../../../shared/types/account";
import type { LuponHearing } from "../types";

/* Two. This Lupon mediates and conciliates; it does not arbitrate. */
export const HEARING_TYPES = ["Mediation", "Conciliation"];

export const OUTCOME_STATUSES = ["Completed", "Rescheduled", "Cancelled", "No Show"];

export const today = () => new Date().toISOString().slice(0, 10);

export const asDate = (value?: string | null) => {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-PH");
  }
  return new Date(value).toLocaleDateString("en-PH");
};

/** Scheduled, summons issued, but no proof of service on file. */
export const unserved = (h: LuponHearing) =>
  h.status === "Scheduled" && !h.summons_served_date;

/*
 * WHOSE DESK A ROW BELONGS TO.
 *
 * Three offices open this room and see the same calendar, but only one of
 * them may touch a given row: the Barangay Secretary keeps the record of the
 * Punong Barangay's Tuesdays, the Lupon works its own Thursdays, and the
 * Punong Barangay works nothing at all — they preside, and the officer who
 * presides is not the officer who writes down what was decided.
 *
 * Mirrors `App\Services\Lupon\HearingDesk` on the server, which is what
 * actually enforces it. This is here so a button that would be refused is
 * never drawn: a greyed-out row of icons still says "this is yours, but not
 * now", and none of these ever become the reader's.
 */
export const MEDIATION_DESK = "Main Office";

export const CONCILIATION_DESK = "Lupon";

/** The office that works sittings of this kind. */
export const deskForType = (hearingType?: string | null) =>
  hearingType === "Conciliation" ? CONCILIATION_DESK : MEDIATION_DESK;

/** The office that prints the summons for a case at this stage. */
export const deskForStage = (stage?: string | null) =>
  stage === "For Summons" ? MEDIATION_DESK
    : stage === "For Lupon Summons" ? CONCILIATION_DESK
      : null;

/** Admin stands in for whoever is away; the Punong Barangay for nobody. */
export const worksDesk = (user: User | null | undefined, desk: string | null) =>
  !!user && !!desk && user.role !== "Punong Barangay"
  && (user.office === "Admin" || user.office === desk);

/** May this user write to this sitting? */
export const worksSitting = (user: User | null | undefined, h: LuponHearing) =>
  worksDesk(user, deskForType(h.hearing_type));

/**
 * The hearing room's screens — one per address, all six on the sidebar.
 *
 * "For summons" comes first because it comes first in the day: it is the
 * work that has been HANDED to this desk and has no sitting yet. The three
 * sittings views are the calendar itself; the last two are lists of CASES
 * the room keeps beside it — the ones withdrawn, and the ones certified to
 * court.
 *
 * Today, Upcoming and Past used to be a dropdown on the page rather than
 * places, so none of them could be linked to and all three reported the
 * same address. There is no PB_VIEWS list any more, and no navigation on
 * the page: the sidebar is the only menu.
 */
export type View = "for-summons" | "today" | "upcoming" | "past" | "cancelled" | "cfa";

/** The sittings views, where a row is a hearing rather than a case. */
export const SITTING_VIEWS: View[] = ["today", "upcoming", "past"];

export const isSittingView = (view: View) => SITTING_VIEWS.includes(view);

/**
 * The two ways a sitting can end.
 *
 * Chosen, never typed: "settled" written into a free box closed nothing and
 * left three more sittings on the calendar for a case that was over.
 *
 * THERE IS NO "MOVE TO THE LUPON" TO PICK. The barangay gives the parties
 * three sittings and they are entitled to all three; a third option here
 * let one sitting end what the law gives three. When the last of the three
 * is recorded unsettled the case moves on by itself.
 */
export const SESSION_OUTCOMES = [
  {
    value: "Unsettled",
    label: "Unsettled",
    hint: "Nothing was agreed. The next sitting stands — and if this was the last of the three, the case moves on by itself.",
  },
  {
    value: "Agreement",
    label: "Agreement",
    hint: "The terms below become the settlement: the case closes and the remaining sittings are stood down.",
  },
] as const;
