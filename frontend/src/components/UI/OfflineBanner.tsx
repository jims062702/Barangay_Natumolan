import { useEffect, useState } from "react";
import { FiWifiOff } from "react-icons/fi";
import { useIsOffline } from "../../hooks/useConnectivity";

/**
 * Says the line is down, and says it where it cannot be missed.
 *
 * Not a toast. A toast is for something that happened once; being offline is
 * a condition that lasts, and it changes what every button on the page will
 * do. A clerk who does not know they are offline will believe a certificate
 * was filed when it is sitting in a queue.
 *
 * It also has to be honest about what still works. "No internet connection"
 * on its own reads as "stop what you are doing", and the whole point of the
 * work behind this banner is that they should NOT stop.
 */
export default function OfflineBanner({
  held = 0,
  syncing = false,
}: {
  /** How many residents the device is holding. */
  held?: number;
  syncing?: boolean;
}) {
  const offline = useIsOffline();

  /*
   * Kept mounted for the exit, so the bar slides away rather than vanishing.
   * A banner that disappears between blinks leaves people unsure whether
   * they saw it — and this one is the difference between trusting the screen
   * and not.
   */
  const [shown, setShown] = useState(offline);

  useEffect(() => {
    if (offline) {
      setShown(true);

      return;
    }

    const timer = window.setTimeout(() => setShown(false), 400);

    return () => window.clearTimeout(timer);
  }, [offline]);

  if (!shown) {
    return null;
  }

  return (
    <div
      /*
       * `polite`, not `assertive`. A screen reader user mid-sentence should
       * be told at the next pause, not interrupted — they are as likely to
       * be halfway through a resident's name as anyone else.
       */
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 bg-dark px-4 py-2 text-center text-xs font-medium text-white transition-all duration-300 ${
        offline ? "max-h-12 opacity-100" : "max-h-0 overflow-hidden py-0 opacity-0"
      }`}
    >
      <FiWifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {/*
        What is actually available decides the wording.

        "You can keep working" is a promise, and with an empty cache it is
        a false one — the clerk would search for a walk-in, find nobody,
        and have been told by this very bar that things were fine. The
        count is the difference between the two sentences.
      */}
      {held > 0 ? (
        <span>
          No connection — <span className="text-gray-300">
            you can keep working. {held.toLocaleString("en-PH")} residents are
            stored on this device.
          </span>
        </span>
      ) : (
        <span>
          No connection —{" "}
          <span className="text-gray-300">
            {syncing
              ? "still downloading the resident list…"
              : "no residents are stored on this device yet, so searching will not work. Connect once first."}
          </span>
        </span>
      )}
    </div>
  );
}
