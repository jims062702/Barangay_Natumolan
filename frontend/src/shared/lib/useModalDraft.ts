import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "./formDraft";

/**
 * A modal form's unsaved input, kept until it is SAVED, DISCARDED, or the
 * account SIGNS OUT — never lost to a stray click outside the dialog.
 *
 *   open the form      its draft, if it has one, is put back
 *   type               written down as it is typed (a short pause, not
 *                      every keystroke)
 *   close it           — the X, Escape, a click outside, Cancel, leaving the
 *                      page — the draft stays, exactly as it was
 *   save succeeds      clear(): the next open is a fresh form, and nothing
 *                      is written until then
 *   save fails         nothing: the draft and the form stay for a retry
 *   discard            discard(): gone, and the form is reset
 *   sign out           every draft goes (AuthContext → clearAllDrafts)
 *
 * WHOSE: drafts are kept per signed-in account (formDraft's owner), so one
 * clerk's never appears for the next person at the same desk, and nothing
 * is kept with nobody signed in.
 *
 * WHICH: `key` names the form, and an edit form's key names its record —
 * "edit-resident:12" is not "edit-resident:45". Pass null to keep nothing.
 *
 * WHAT: `value` is the form's own fields — no File objects (a browser file
 * cannot be written down, so an attachment is chosen again) and never a
 * password. `memoryOnly` keeps it in this tab's memory instead of on disk:
 * the VAWC desk's, whose records are never kept on a device.
 *
 * EDITS AND NEWER DATA: pass the record's `version` (its updated_at). A
 * draft typed against an older version is not put back over newer saved
 * data; the form opens on the record as it now is, and says why.
 *
 * Called AFTER the form's own "reset when opened" effect, so a restored
 * draft lands on top of the reset rather than under it.
 */
export interface ModalDraft {
  /** A draft was put back when the form opened. */
  restored: boolean;
  /** When what is on screen was last written down, or null when nothing is. */
  savedAt: number | null;
  /** A draft existed, but the record has been saved elsewhere since. */
  stale: boolean;
  /** The save succeeded: forget the draft. */
  clear: () => void;
  /** The staff chose to throw it away: forget it and reset the form. */
  discard: () => void;
}

export function useModalDraft<T>(
  key: string | null,
  open: boolean,
  value: T,
  restore: (draft: T) => void,
  options: {
    /**
     * The form as it opens with nothing typed — today's date, the default
     * choice. A form still exactly like this keeps no draft.
     */
    blank?: T;
    /** Or say it outright: a form with nothing in it keeps no draft. */
    isEmpty?: (value: T) => boolean;
    /** Put the form back to blank — for discard(). */
    reset?: () => void;
    memoryOnly?: boolean;
    version?: string | null;
  } = {},
): ModalDraft {
  const { blank, reset, memoryOnly = false, version = null } = options;
  const blankJson = blank === undefined ? null : JSON.stringify(blank);
  const [restored, setRestored] = useState(false);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /*
   * The form as it is while OPEN: its fields, which draft they belong to,
   * the record's version and what counts as blank. A form that clears its
   * fields — or forgets which record it was editing — as it closes must not
   * have that written over its draft; the last keystrokes go where they
   * were typed.
   */
  const session = useRef({ value, key, version, blankJson, isEmpty: options.isEmpty });
  if (open) session.current = { value, key, version, blankJson, isEmpty: options.isEmpty };
  /* Saved: nothing more is written until the form is opened again, so a
     change on the way out (a list reloading, a reset) is not a new draft. */
  const suspended = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* What is known to be on disk (or deliberately not), so the same value is
     never written twice and a just-saved form is not written back. */
  const written = useRef<string | null>(null);
  const wasOpen = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  const store = useCallback(() => {
    const { value: v, key: k, version: ver, blankJson: empty, isEmpty } = session.current;
    if (!k || suspended.current) return;
    const serialised = JSON.stringify(v);
    if (serialised === written.current) return;
    written.current = serialised;

    if ((empty !== null && serialised === empty) || (isEmpty?.(v) ?? false)) {
      clearDraft(k, { memoryOnly });
      setSavedAt(null);

      return;
    }
    saveDraft(k, v, { memoryOnly, version: ver });
    setSavedAt(Date.now());
  }, [memoryOnly]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      store();
    }
  }, [store]);

  /* Opened: put the draft back. Closed: write down what is there, now. */
  useEffect(() => {
    if (open && !wasOpen.current && key) {
      suspended.current = false;
      const kept = loadDraft<T>(key, { memoryOnly });
      setStale(false);
      if (kept && (!version || !kept.version || kept.version === version)) {
        restoreRef.current(kept.value);
        written.current = JSON.stringify(kept.value);
        setRestored(true);
        setSavedAt(kept.savedAt);
      } else {
        if (kept) {
          /* Typed against a version of the record that has since changed:
             not put over newer saved data. */
          clearDraft(key, { memoryOnly });
          setStale(true);
        }
        written.current = null;
        setRestored(false);
        setSavedAt(null);
      }
    }
    if (!open && wasOpen.current) flush();
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  /* Typed: written down after a short pause, not on every keystroke. */
  useEffect(() => {
    if (!open || !key) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      store();
    }, 400);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), open, key]);

  /* Leaving the page with the form open still keeps what was typed — a
     route change unmounts the form; a refresh or a closed tab does not, so
     the last keystrokes before one are written down on pagehide. */
  useEffect(() => {
    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { key: k, value: v } = session.current;
    if (k) clearDraft(k, { memoryOnly });
    /* What is on screen now is saved — it is not a draft to write back. */
    written.current = JSON.stringify(v);
    suspended.current = true;
    setRestored(false);
    setSavedAt(null);
  }, [memoryOnly]);

  /* Thrown away, but the form stays open: what is typed next is a new draft. */
  const discard = useCallback(() => {
    clear();
    suspended.current = false;
    written.current = null;
    reset?.();
  }, [clear, reset]);

  return { restored, savedAt, stale, clear, discard };
}
