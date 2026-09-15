/**
 * The stages a certificate moves through at the counter.
 */

/**
 * The counter workflow, in order — three presses from request to hand-over.
 *
 * Nobody approves or rejects a certificate, and nobody clicks a signature
 * either: the resident asks, the clerk prints, the Punong Barangay signs the
 * paper on its way to the counter, and the clerk hands it over. Each stage is
 * a thing that happened to the DOCUMENT.
 */
export const FLOW = ["Pending", "Processing", "Ready to Claim", "Released"];

export const STATUS_TABS = ["", ...FLOW, "Cancelled"];

/** One line of plain guidance per stage, shown on the row's detail. */
export const STAGE_HELP: Record<string, string> = {
  Pending:
    "A resident requested this online. Accept it to start — nothing else is waiting on anyone.",
  Processing:
    "You are preparing this certificate. Check the wording, then press Print: that prints it, tells the resident it is ready to claim, and locks the details.",
  "Ready to Claim":
    "Printed and waiting on the counter — get it signed on the way. The resident has already been notified. Release it when they collect it.",
  Released: "Handed to the resident, who has been notified. The request is complete.",
};
