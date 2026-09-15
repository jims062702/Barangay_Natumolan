import { useEffect, useState } from "react";
import { FiAlertCircle, FiLoader } from "react-icons/fi";

/**
 * Whether THIS device is actually ready to work with no line.
 *
 * The failure this exists for is the worst kind: silent. A service worker
 * that never finished installing looks exactly like one that did — until
 * the line drops, the clerk refreshes, and the browser shows its dinosaur
 * instead of the app. By then it is too late to do anything about it.
 *
 * Three things have to be true, and each is asked directly rather than
 * assumed:
 *
 *   REGISTERED  a worker exists for this origin
 *   CONTROLLING it is serving THIS page — a page loaded before the worker
 *               activated is not covered, and a refresh is what fixes that
 *   STOCKED     the shell is actually in the cache, not merely promised
 *
 * A NOTE ON ORIGINS, because it has already cost an afternoon: a service
 * worker belongs to a scheme, host AND PORT. Testing on :4173 and then on
 * :4174 is two separate origins with two separate workers and two separate
 * caches — the second starts from nothing, and going offline before it
 * finishes leaves exactly the dinosaur described above.
 */

type Readiness =
  | { state: "checking" }
  | { state: "unsupported"; why: string }
  | { state: "preparing"; cached: number }
  | { state: "ready"; cached: number }
  | { state: "needs-refresh"; cached: number };

async function inspect(): Promise<Readiness> {
  if (!("serviceWorker" in navigator)) {
    return { state: "unsupported", why: "This browser cannot work offline." };
  }

  if (!window.isSecureContext) {
    /* The single most common deployment mistake, and it fails silently. */
    return {
      state: "unsupported",
      why: "HTTPS is required. Offline mode does not work over http://.",
    };
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  if (registrations.length === 0) {
    return { state: "preparing", cached: 0 };
  }

  /* What is actually in the box. `caches.keys()` is the only honest answer:
     a registration can exist with an install that failed and stored nothing. */
  let cached = 0;

  try {
    for (const key of await caches.keys()) {
      cached += (await (await caches.open(key)).keys()).length;
    }
  } catch {
    /* Storage blocked. Treated as nothing cached, which it effectively is. */
  }

  if (cached === 0) {
    return { state: "preparing", cached };
  }

  /*
   * Controlling is the part people miss. The very first visit installs the
   * worker but is NOT served by it, so that page would still hit the
   * network offline. One refresh puts it under the worker's control.
   */
  if (!navigator.serviceWorker.controller) {
    return { state: "needs-refresh", cached };
  }

  return { state: "ready", cached };
}

export default function OfflineReadiness() {
  const [readiness, setReadiness] = useState<Readiness>({ state: "checking" });

  useEffect(() => {
    let alive = true;

    const look = async () => {
      const next = await inspect();

      if (alive) {
        setReadiness(next);
      }
    };

    void look();

    /* While it is still filling, keep looking — the install takes seconds
       and the office should watch it finish rather than guess. */
    const timer = window.setInterval(() => void look(), 3000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (readiness.state === "checking") {
    return null;
  }

  /*
   * Nothing at all when everything is in order.
   *
   * A green tick that never goes away is a green tick nobody reads, and
   * this card is only worth its space on the day it says something is
   * wrong. The offline banner already reports what is held when the line
   * is actually down.
   */
  if (readiness.state === "ready") {
    return null;
  }

  const tone = {
    unsupported: "border-danger/30 bg-danger/5 text-danger",
    preparing: "border-gray bg-secondary/40 text-gray-500",
    "needs-refresh": "border-warning/40 bg-warning/5 text-dark",
  }[readiness.state];

  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs ${tone}`}>
      {readiness.state === "preparing" ? (
        <FiLoader className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}

      <div>
        {readiness.state === "unsupported" && (
          <>
            <p className="font-semibold">Not ready for offline use</p>
            <p className="mt-0.5">{readiness.why}</p>
          </>
        )}

        {readiness.state === "preparing" && (
          <>
            <p className="font-semibold text-dark">Preparing offline mode</p>
            <p className="mt-0.5">
              The app is still being saved to this device. Stay connected until
              it finishes — it only takes a few seconds.
            </p>
          </>
        )}

        {readiness.state === "needs-refresh" && (
          <>
            <p className="font-semibold">One refresh needed</p>
            <p className="mt-0.5">
              The app is saved ({readiness.cached} files), but it is not serving
              this page yet. Refresh once while connected, and it will be
              ready.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
