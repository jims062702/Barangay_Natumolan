import { registerSW } from "virtual:pwa-register";
import { toast } from "../lib/toast";

/**
 * Registers the worker that makes the app load with no network.
 *
 * WHY AN UPDATE IS OFFERED AND NOT FORCED. Applying a new build the moment it
 * lands reloads the page under the clerk's hands — halfway through typing a
 * certificate, with a resident waiting. So a new version waits for the office
 * to take it.
 *
 * WHY THE OFFER IS A BANNER AND NOT A TOAST. It used to be a toast, and a
 * toast disappears in a few seconds. An office that missed it stayed on the
 * old build indefinitely — and the service worker kept serving that old build
 * faithfully, even after the files on the server had changed. That is exactly
 * how a device went on showing a status label that had already been removed
 * from the code: the fix was deployed and never arrived.
 *
 * So the offer now stays on screen, with a button, until it is taken.
 */

type Listener = (available: boolean) => void;

const listeners = new Set<Listener>();
let updateAvailable = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

function announce(): void {
  listeners.forEach((listener) => listener(updateAvailable));
}

/** Subscribes to "a new version is waiting". */
export function watchUpdate(listener: Listener): () => void {
  listeners.add(listener);
  listener(updateAvailable);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Takes the waiting version and reloads onto it.
 *
 * Only ever from a person pressing the button — never on its own — so the
 * reload happens when the clerk has chosen a moment, not in the middle of one.
 */
export async function updateNow(): Promise<void> {
  if (applyUpdate) {
    await applyUpdate(true);

    return;
  }

  /* No waiting worker to hand over to: a plain reload still picks up
     whatever the server has now. */
  window.location.reload();
}

export function registerServiceWorker(): void {
  /*
   * In development or tunnel testing, unregister any stale service workers
   * and clean old cache so other devices always get the latest code.
   */
  if (import.meta.env.DEV) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
    }
    return;
  }

  /*
   * Only where it can actually work. A service worker needs a secure context
   * — HTTPS, or localhost — and silently does nothing elsewhere. Checking
   * first means the absence is reported here rather than discovered as
   * "offline mode does not work" on a machine set up over plain http.
   */
  if (!("serviceWorker" in navigator)) {
    console.info("[offline] this browser has no service worker; the app will need a connection.");

    return;
  }

  if (!window.isSecureContext) {
    console.warn(
      "[offline] not a secure context, so offline support is OFF. "
      + "The site has to be served over HTTPS (Hostinger provides this free).",
    );

    return;
  }

  applyUpdate = registerSW({
    onNeedRefresh() {
      updateAvailable = true;
      announce();
    },

    onOfflineReady() {
      /*
       * Said once, deliberately: this is the moment offline mode becomes
       * true on THIS machine. An office that never sees it has never been
       * offline-capable, and would otherwise only find out during an outage.
       */
      toast("Offline mode is ready on this device.", "success");
    },

    onRegisterError(error) {
      console.error("[offline] the service worker failed to register", error);
    },
  });
}
