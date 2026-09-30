import type { ModalDraft } from "../lib/useModalDraft";

/**
 * The quiet line under a form that says its input is being kept.
 *
 * Not a popup, not a question: closing the dialog needs no confirmation,
 * because nothing is lost by it. "Discard draft" is the one deliberate way
 * to throw the typing away.
 */
export default function DraftNotice({ draft, files = false, tabOnly = false, ownDiscard = false, passwords = false }: {
  draft: ModalDraft;
  /** The form has an attachment, which a draft cannot keep. */
  files?: boolean;
  /** Kept in this tab's memory only (the VAWC desk): gone on refresh, never written to the device. */
  tabOnly?: boolean;
  /** The form has its own Discard button already; this line only says the draft is kept. */
  ownDiscard?: boolean;
  /** The form has a password box, which is never kept. */
  passwords?: boolean;
}) {
  if (draft.stale) {
    return (
      <p className="text-xs text-warning">
        Unsaved changes from earlier were not restored: this record has been saved since.
      </p>
    );
  }

  if (!draft.savedAt) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-400" aria-live="polite">
      <span>
        {draft.restored ? "Draft restored." : "Draft saved."} Unsaved changes stay if you close this form
        {files ? " (an attached file has to be chosen again)" : ""}.
        {passwords ? " Passwords are never kept." : ""}
        {tabOnly ? " Kept in this tab only — never saved on the device." : ""}
      </span>
      {!ownDiscard && <button
        type="button"
        onClick={draft.discard}
        className="cursor-pointer font-semibold text-gray-500 underline-offset-2 hover:text-danger hover:underline"
      >
        Discard draft
      </button>}
    </p>
  );
}
