/**
 * What may be done with a settlement, and when.
 */

import type { LuponSettlement } from "../types";

export const STATUSES = [
  "Within Repudiation Period",
  "Final",
  "Repudiated",
  "Complied",
  "Not Complied",
  "Executed",
];

export const asDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PH") : "—";

/** Days until `date`; negative means already past. */
export const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const diff = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
};

/**
 * Which compliance/execution actions the current status allows. Mirrors the
 * state machine in LuponController::applySettlementAction.
 */
export const actionsFor = (s: LuponSettlement): { action: string; label: string; tone: string }[] => {
  const out: { action: string; label: string; tone: string }[] = [];

  if (s.status === "Within Repudiation Period") {
    out.push({ action: "finalize", label: "Finalize", tone: "success" });
    out.push({ action: "repudiate", label: "Repudiate", tone: "danger" });
  }
  if (["Final", "Not Complied"].includes(s.status)) {
    out.push({ action: "mark_complied", label: "Complied", tone: "success" });
    out.push({ action: "mark_not_complied", label: "Not complied", tone: "danger" });
    out.push({ action: "execute", label: "Execute", tone: "primary" });
  }

  return out;
};

/** What each action does, shown on hover and spelled out under the buttons. */
export const ACTION_HELP: Record<string, string> = {
  finalize: "End the repudiation window early — the settlement becomes binding.",
  repudiate:
    "A party rejected the settlement within 10 days for fraud, violence or intimidation. The case returns to conciliation.",
  mark_complied: "The obligations were carried out. Closes the settlement.",
  mark_not_complied: "The deadline passed without compliance. Execution becomes available.",
  execute:
    "Enforce the settlement. Within 6 months the Lupon may execute it; after that it takes a court action.",
};

export const TONES: Record<string, string> = {
  success: "bg-success text-white hover:opacity-90",
  danger: "border border-danger/40 text-danger hover:bg-danger hover:text-white",
  primary: "border border-primary/40 text-primary hover:bg-primary hover:text-white",
  muted: "border border-gray text-gray-500 hover:border-primary hover:text-primary",
};
