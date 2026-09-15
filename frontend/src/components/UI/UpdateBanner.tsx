import { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { updateNow, watchUpdate } from "../../lib/serviceWorker";

/**
 * A new version is ready, and it stays on screen until it is taken.
 *
 * This replaced a toast that vanished after a few seconds. Offices missed it,
 * stayed on the old build, and the service worker went on serving that old
 * build — so fixes that had been deployed never reached the device doing the
 * work. A bar that remains until someone presses Update cannot be missed the
 * same way.
 *
 * It does not update on its own. The clerk may be halfway through a form with
 * a resident waiting; they choose the moment.
 */
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => watchUpdate(setAvailable), []);

  if (!available) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center text-xs font-medium text-white"
    >
      <span>A new version of the system is available. Finish what you are doing, then update.</span>
      <button
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          void updateNow();
        }}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-primary hover:bg-white/90 disabled:opacity-70"
      >
        <FiRefreshCw className={`h-3 w-3 ${updating ? "animate-spin" : ""}`} aria-hidden="true" />
        {updating ? "Updating…" : "Update now"}
      </button>
    </div>
  );
}
