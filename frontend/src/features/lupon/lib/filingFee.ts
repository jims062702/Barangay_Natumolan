/**
 * THE FILING FEE'S THREE CALENDAR DAYS, as the screens say them.
 *
 * The server keeps the rule (FilingFeeDeadlines): the fee is due by the END
 * of the third calendar day after the case was filed, in Manila, and a case
 * still unpaid then is closed as "Closed — Unpaid". The fee's state and the
 * case's stage are separate fields; this reads both and says, in one line,
 * where the fee stands and how long is left.
 */

export const FEE_DAYS = 3;
export const CLOSED_UNPAID = "Closed — Unpaid";

export interface FeeFields {
  current_stage: string;
  payment_status?: string | null;
  payment_due_at?: string | null;
}

export interface FeeStanding {
  tone: "success" | "warning" | "danger";
  label: string;
  detail: string;
}

const manilaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** "Thu, Oct 1, 2026" — the last day to pay. */
export function dueDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

/** Whole calendar days from today to the due day, in Manila — 0 on the day itself. */
export function daysLeft(iso: string, now = new Date()): number {
  const due = Date.parse(`${manilaDay(new Date(iso))}T00:00:00Z`);
  const today = Date.parse(`${manilaDay(now)}T00:00:00Z`);

  return Math.round((due - today) / 86_400_000);
}

export function feeStanding(c: FeeFields): FeeStanding | null {
  if (c.current_stage === CLOSED_UNPAID) {
    return {
      tone: "danger",
      label: CLOSED_UNPAID,
      detail: "The filing fee was not paid.",
    };
  }
  if (c.payment_status === "Paid") return { tone: "success", label: "Paid", detail: "Filing fee paid." };
  if (c.payment_status === "Overdue") return { tone: "danger", label: "Overdue", detail: "The filing fee was not paid in time." };
  if (c.payment_status === "Unpaid") return { tone: "warning", label: "Unpaid", detail: "Filing fee not yet paid." };

  return null;
}

export const TONE_CLASSES: Record<FeeStanding["tone"], string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};
