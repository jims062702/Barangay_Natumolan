import { FiWifiOff } from "react-icons/fi";
import { useIsOffline } from "./useConnectivity";

/**
 * What a resident is told when their phone loses signal.
 *
 * The portal is an online service and is meant to be: everything on it —
 * a request, an appointment, the status of a certificate — is the barangay
 * answering, and an answer kept on a phone from yesterday is a promise
 * nobody made. The offices are the ones that cannot stop when the line
 * goes; a resident can come back in five minutes.
 *
 * So rather than half a page of stale figures, this says what is happening
 * and what to do about it.
 */
export default function PortalOfflineBanner() {
  if (!useIsOffline()) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-dark px-4 py-2 text-center text-xs font-medium text-white">
      <FiWifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        No connection. The portal needs the internet — your requests and certificates are safe,
        and this page will work again as soon as you are back online.
      </span>
    </div>
  );
}
