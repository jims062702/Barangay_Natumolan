/**
 * The Katarungang Pambarangay path a case walks, and the time each step allows.
 */

import type { LuponCase } from "../types";

export const STAGES = ["Filed", "Mediation", "Conciliation", "Settled"];

/**
 * Where a case has actually been, read from what happened to it.
 *
 * The bar used to colour itself from `current_stage` alone, by looking that
 * one word up in the list above. Every case that had LEFT the track came out
 * with nothing highlighted at all — "Referred" is not in the list, so the
 * lookup returned -1 and the whole path went grey — which is exactly the
 * case an office most needs to read, and exactly the one that told them
 * nothing.
 *
 * So the steps are lit from the case's own history: a mediation was held or
 * it was not. That is a fact on the record, and it stays true after the case
 * has moved on.
 */
export function reachedStages(caseData: LuponCase): Set<string> {
  const held = (type: string) =>
    (caseData.hearings ?? []).some((h) => h.hearing_type === type);

  const reached = new Set<string>(["Filed"]);

  if (held("Mediation") || ["Mediation", "For Lupon Summons", "Conciliation", "Settled", "Referred"]
    .includes(caseData.current_stage)) {
    reached.add("Mediation");
  }

  // Conciliation only if a Pangkat actually sat. A case referred straight
  // from mediation never reached it, and saying otherwise would hide that
  // the Pangkat step was skipped.
  if (held("Conciliation") || ["Conciliation", "Settled"].includes(caseData.current_stage)) {
    reached.add("Conciliation");
  }

  if (caseData.current_stage === "Settled" || caseData.settlement) {
    reached.add("Settled");
  }

  return reached;
}

/** Where the case stands now, in the words the flowchart uses. */
export const EXIT_GUIDE: Record<string, { what: string; next: string }> = {
  Referred: {
    what: "Conciliation ended without an agreement, so a Certificate to File Action was issued.",
    next: "The complainant may now take the matter to the city or municipal court. The Lupon has done what the law asks of it.",
  },
  Dismissed: {
    what: "The case was dropped — withdrawn, outside this Lupon's jurisdiction, or the complainant did not pursue it.",
    next: "Nothing further is scheduled. The record stays on the docket.",
  },
};

/**
 * What each stage means and the period the law allows for it, so the docket
 * is readable without a copy of the Local Government Code on the desk.
 */
export const STAGE_GUIDE: Record<string, { what: string; period: string }> = {
  Filed: {
    what: "Complaint received and docketed. When the complainant shows the official receipt for the filing fee, press Paid — that forwards the case to the Barangay Secretary.",
    period: "Nothing is scheduled until the receipt is seen.",
  },
  /* The two waiting rooms. A case in one is on somebody's desk with no
     sitting behind it, which is exactly the state the docket could not show
     before — and the state an office most needs to be able to chase. */
  "For Summons": {
    what: "With the Barangay Secretary. They print the notice of hearing for the complainant and the summons for the respondent, and THAT printing books three Tuesdays with the Punong Barangay.",
    period: "Print promptly: nothing is on any calendar until the paper exists.",
  },
  "For Lupon Summons": {
    what: "The three Tuesdays are spent with no agreement, so the case is with the Lupon. They print the summons and the notice again, which books three Thursdays.",
    period: "Print promptly: the parties have not been given the new dates yet.",
  },
  Mediation: {
    what: "The Punong Barangay personally mediates between the parties. No Pangkat yet, no lawyers — the parties speak for themselves.",
    period: "15 days from the first meeting.",
  },
  Conciliation: {
    what: "Mediation failed, so a Pangkat ng Tagapagkasundo — three Lupon members chosen by the parties — takes over and conciliates.",
    period: "15 days from the Pangkat's first meeting, extendable by 15 more.",
  },
  Settled: {
    what: "The parties signed an amicable settlement. Record the terms and any compliance deadline.",
    period: "Final after 10 days unless repudiated; enforceable like a court judgment.",
  },
};

/** "YYYY-MM-DDTHH:mm" in local time, for a datetime-local input. */
export const localNow = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

export function daysLeft(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}
