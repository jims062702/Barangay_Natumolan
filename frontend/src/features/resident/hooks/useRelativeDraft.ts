import { useRef, useState, useEffect } from "react";
import { loadDraft, clearDraft, saveDraft } from "../../../shared/lib/formDraft";
import { confirmAction } from "../../../shared/lib/confirm";
import type { AddRelativeProps, Draft } from "../components/addRelative/types";
import type { RelativeBatchState } from "./useRelativeBatch";

/**
 * The unsaved batch, kept as a draft so a closed tab does not lose it.
 */
export function useRelativeDraft(ctx: AddRelativeProps & RelativeBatchState) {
  const {
    blankEntry, entries, existingChildren, guardianReason, guardianStartedOn, open, relation,
    resident, setEntries, setError, setExisting, setExistingChildren, setGuardianReason,
    setGuardianStartedOn, setHhForIndex, setMode, setNamesakes, setPendingIndex, setSavedNames,
    setUnionType, unionType,
  } = ctx;

  /** This form's own draft — one per subject and relation. */
  const draftKey = `add-relative:${resident.id}:${relation}`;
  /** The form as it looks untouched, so a draft of nothing is never kept. */
  const pristineRef = useRef("");
  /** Set the moment a batch goes in, so the draft is not written back. */
  const doneRef = useRef(false);
  /** What was last written, so an unchanged form is not written again. */
  const lastWrittenRef = useRef("");
  /** When the restored draft was typed, or null if this form is fresh. */
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const freshDraft = (): Draft => ({
    entries: [blankEntry()],
    unionType: "Married",
    guardianReason: "",
    guardianStartedOn: "",
    existingChildren: "none",
  });
  const applyDraft = (draft: Draft) => {
    setEntries(draft.entries);
    setUnionType(draft.unionType);
    setGuardianReason(draft.guardianReason ?? "");
    setGuardianStartedOn(draft.guardianStartedOn ?? "");
    setExistingChildren(draft.existingChildren ?? "none");
  };
  useEffect(() => {
    if (!open) return;
    /*
     * The lola is almost always already registered — very often as the head
     * of the household the child was entered into — so the guardian form
     * opens on "find them" rather than sending the clerk through a whole
     * registration for somebody the barangay already knows.
     */
    setMode(relation === "guardian" ? "existing" : "new");
    setExisting(null);
    setError("");
    setNamesakes(null);
    setPendingIndex(0);
    setHhForIndex(null);
    doneRef.current = false;

    const fresh = freshDraft();
    pristineRef.current = JSON.stringify(fresh);

    /*
     * Anything left from last time comes back. The dialog closes on a click
     * outside it and asks nothing first, so twenty minutes of typing must not
     * depend on the clerk's aim.
     */
    const kept = loadDraft<Draft>(draftKey);
    if (kept && Array.isArray(kept.value.entries) && kept.value.entries.length > 0) {
      applyDraft(kept.value);
      // Already on disk, exactly as it is about to be in state — writing it
      // straight back would only reset its age and lie about when it was typed.
      lastWrittenRef.current = JSON.stringify(kept.value);
      setSavedNames(
        kept.value.entries
          .filter((entry) => entry.saved)
          .map((entry) => `${entry.form.first_name} ${entry.form.last_name}`.trim())
      );
      setRestoredAt(kept.savedAt);
      return;
    }

    applyDraft(fresh);
    lastWrittenRef.current = "";
    setSavedNames([]);
    setRestoredAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, relation, resident.id]);
  /*
   * Written on every change, because the work has to be safe BEFORE the stray
   * click, not rescued after it. A form still sitting at its opening state is
   * not a draft, and clearing it here is what stops a mere look-and-close from
   * coming back as "picked up where you left off".
   */
  useEffect(() => {
    if (!open || doneRef.current || entries.length === 0) return;

    const current: Draft = {
      entries, unionType, guardianReason, guardianStartedOn, existingChildren,
    };

    const serialised = JSON.stringify(current);

    if (serialised === pristineRef.current) {
      clearDraft(draftKey);
      lastWrittenRef.current = "";
      return;
    }
    if (serialised === lastWrittenRef.current) return;

    lastWrittenRef.current = serialised;
    saveDraft(draftKey, current);
  }, [
    open, draftKey, entries, unionType, guardianReason, guardianStartedOn, existingChildren,
  ]);
  /** Throws the restored draft away and starts the form over. */
  const discardDraft = async () => {
    if (
      !(await confirmAction({
        title: "Start over?",
        text: "What was typed before is deleted and the form starts empty.",
        confirmText: "Yes, start over",
      }))
    )
      return;

    const fresh = freshDraft();
    pristineRef.current = JSON.stringify(fresh);
    applyDraft(fresh);
    clearDraft(draftKey);
    lastWrittenRef.current = "";
    setSavedNames([]);
    setRestoredAt(null);
  };

  return {
    draftKey, pristineRef, doneRef, lastWrittenRef, restoredAt, setRestoredAt, freshDraft,
    applyDraft, discardDraft,
  };
}

export type RelativeDraftState = ReturnType<typeof useRelativeDraft>;
