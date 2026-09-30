import { FiAlertCircle, FiCheckCircle, FiCloudOff, FiLoader } from "react-icons/fi";
import type { CensusFormState } from "../../hooks/useCensusForm";

/**
 * Where the draft stands, beside Preview form — in a line, not a toast.
 *
 * "Draft saved" appears only once the server has answered. A save that
 * failed says so and can be tried again; with no line the form says it is
 * not saved yet, and offers to keep it on this device.
 */
export function DraftStatus({ ctx }: { ctx: CensusFormState }) {
  const { draftSave, draftSavedAt, draftError, persist, saveOnDevice, status } = ctx;

  if (status !== "Draft") return null;

  const base = "inline-flex items-center gap-1.5 text-xs";

  switch (draftSave) {
    case "saving":
      return (
        <span className={`${base} text-gray-500`} data-testid="draft-status" data-state="saving">
          <FiLoader className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saving draft…
        </span>
      );
    case "saved":
      return (
        <span className={`${base} text-success`} data-testid="draft-status" data-state="saved">
          <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Draft saved{draftSavedAt ? ` · ${draftSavedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}` : ""}
        </span>
      );
    case "error":
      return (
        <span className={`${base} text-danger`} data-testid="draft-status" data-state="error" role="alert">
          <FiAlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Draft not saved{draftError ? ` — ${draftError}` : ""}
          <button type="button" onClick={() => void persist()} className="ml-1 cursor-pointer font-semibold underline">
            Try again
          </button>
        </span>
      );
    case "offline":
      return (
        <span className={`${base} text-amber-700`} data-testid="draft-status" data-state="offline">
          <FiCloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          No connection — not saved yet.
          <button type="button" onClick={() => void saveOnDevice()} className="ml-1 cursor-pointer font-semibold underline">
            Keep it on this device
          </button>
        </span>
      );
    default:
      return (
        <span className={`${base} text-gray-400`} data-testid="draft-status" data-state="idle">
          Saved as a draft as you type.
        </span>
      );
  }
}
