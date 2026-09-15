/**
 * The small rules of a session record: attendance, dates and times.
 */

import type { Attendee } from "../types";

export const ATTENDANCE = ["Present", "Late", "Excused", "Absent"] as const;

export const input =
  "w-full rounded-xl border border-gray bg-white px-3 py-2 text-sm text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

/** A blank sheet: the council, ready to be marked. */
export const blankAttendee = (): Attendee => ({
  name: "",
  position: null,
  attendance: "Present",
  remarks: null,
});

export const asDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/** "14:30" out of whatever the API returns — a time column may arrive as "14:30:00". */
export const asTime = (value: string | null) => (value ? value.slice(0, 5) : "");
