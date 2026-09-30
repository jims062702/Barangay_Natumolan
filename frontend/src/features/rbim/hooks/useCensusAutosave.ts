import { useEffect, useState } from "react";
import { isOffline, watchConnectivity } from "../../../shared/offline/connectivity";
import type { CensusAnswersState } from "./useCensusAnswers";
import type { CensusSubmitState } from "./useCensusSubmit";

/** How long the office pauses before what they typed is saved. */
const PAUSE_MS = 900;

/**
 * The census form saves itself as a DRAFT while it is typed.
 *
 * A pause in the typing saves the form to its census record — a new form
 * becomes a Draft on its first save, and every later save updates that same
 * one. So a refresh, a closed tab or a trip to another page finds the form
 * again (see useCensusSubmit for leaving, and "Draft available").
 *
 * Only a Draft: a submitted census has people on the register behind it,
 * and its edits are still saved only when the office previews it again.
 * Nothing is saved before the form has loaded (an empty form must never be
 * saved over one still on its way), or while nothing has changed since the
 * last save. With no line, nothing is sent — the line beside Preview form
 * says so, and offers to keep the form on this device.
 */
export function useCensusAutosave(
  ctx: CensusAnswersState & CensusSubmitState & { pageLoad: { state: string } },
) {
  const { form, members, status, isDirty, persist, pageLoad, registering, setDraftSave, previewOpen } = ctx;
  const ready = pageLoad.state === "ready";
  /* Coming back online saves what waited. */
  const [online, setOnline] = useState(!isOffline());
  useEffect(() => watchConnectivity((now) => setOnline(now === "online")), []);

  useEffect(() => {
    if (!ready || status !== "Draft" || registering || previewOpen) return;
    if (!isDirty()) return;

    if (!online) {
      setDraftSave("offline");
      return;
    }

    const timer = setTimeout(() => {
      void persist();
    }, PAUSE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, members, ready, status, registering, previewOpen, online]);
}
