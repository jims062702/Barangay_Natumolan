import { isAxiosError } from "axios";
import { toast } from "../lib/toast";

/**
 * A page asking for something with no line, said once and plainly.
 *
 * Most screens now answer from what the device holds. A screen the device
 * has never held anything for cannot, and the request it made ends as a
 * rejected promise nobody catches: in the browser that is a red console
 * error, and on screen it is nothing at all.
 *
 * So the app listens for exactly that case — a request that never reached
 * the server — and says it, once, in the same words everywhere. A REFUSAL
 * is left alone: a 403 or a 422 is the server talking, belongs to the page
 * that asked, and is already handled where it matters.
 *
 * Once, and not per request: opening a dashboard with no line can fail four
 * calls at the same moment, and four identical red toasts is noise that
 * teaches people to ignore toasts.
 */
const QUIET_FOR = 8000;
let lastSaid = 0;

function lineIsDown(reason: unknown): boolean {
  return isAxiosError(reason) && !reason.response;
}

export function reportLostRequests(): void {
  window.addEventListener("unhandledrejection", (event) => {
    if (!lineIsDown(event.reason)) {
      return;
    }

    /* Handled: the console error would say nothing the banner does not. */
    event.preventDefault();

    if (Date.now() - lastSaid < QUIET_FOR) {
      return;
    }

    lastSaid = Date.now();
    toast(
      "No connection — some of this page could not be loaded. What this device holds is shown; "
      + "the rest fills in when the line is back.",
      "info",
    );
  });
}
