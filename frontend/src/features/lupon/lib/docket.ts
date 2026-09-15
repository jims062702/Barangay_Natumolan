/**
 * What the complaint intake offers, and what a case waits on next.
 */

import type { LuponCase } from "../types";

export const RELATIONSHIPS = ["Family", "Neighbor", "Business", "Friend", "Other"];

/**
 * What the Lupon has to do next on a case, so the docket reads as a worklist
 * rather than an archive. Everything happens on the case page except
 * post-settlement compliance, which lives in the settlement register.
 */
export function nextStep(c: LuponCase): { label: string; to: string } {
  const open = `/lupon/cases/${c.id}`;

  if (c.jurisdiction_status === "Rejected") return { label: "Rejected — review", to: open };
  if (["Dismissed", "Referred"].includes(c.current_stage))
    return { label: `Closed — ${c.current_stage.toLowerCase()}`, to: open };

  switch (c.current_stage) {
    case "Filed":
      return { label: "Screen & schedule mediation", to: open };
    case "Mediation":
      return { label: "Record mediation outcome", to: open };
    case "Conciliation":
      return { label: "Constitute Pangkat & conciliate", to: open };
    case "Arbitration":
      return { label: "Record arbitration award", to: open };
    case "Settled":
      // Reaching agreement at mediation moves the stage but does not write the
      // settlement — until the terms are recorded the case is nowhere on the
      // compliance register, so send the clerk back to the case to record them.
      return c.settlement
        ? { label: "Monitor compliance", to: "/lupon/settlements" }
        : { label: "Record settlement terms", to: open };
    default:
      return { label: "Open case", to: open };
  }
}

export const CLASSIFICATIONS = [
  "Assault",
  "Theft",
  "Property Damage",
  "Libel",
  "Ejectment",
  "Debt",
  "Family Dispute",
  "Land Dispute",
  "Others",
];
