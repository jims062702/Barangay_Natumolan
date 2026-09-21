import { useState } from "react";

/**
 * The desks that are never kept on the device, saying so.
 *
 * Most of the system works with no line: the counter, the health station,
 * the Lupon docket, the register. Three do not, and each for a reason that
 * is not about convenience:
 *
 *   VAWC      a survivor's case must not sit on a laptop. The server
 *             encrypts it with a key the browser never holds.
 *   Accounts  who may do what is decided by the server, every time it is
 *             asked. A cached answer is a permission nobody granted.
 *   Live chat a conversation is only a conversation while both sides can
 *             hear each other.
 *
 * So these say plainly that they need the line, rather than showing an
 * empty table that reads as "there is nothing here".
 */
export function useNeedsConnection() {
  const [offline, setOffline] = useState(false);

  /* Only a request that never arrived. A refusal is the server talking. */
  const noteOffline = (error: unknown) => {
    if (!(error as { response?: unknown })?.response) {
      setOffline(true);

      return;
    }

    setOffline(false);
  };

  return { offline, noteOffline };
}

export default function NeedsConnection({ what, why }: { what: string; why: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-3">
      <p className="text-sm font-semibold text-dark">No connection — {what} cannot be shown</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{why}</p>
      <p className="mt-2 text-xs text-gray-500">
        Nothing is lost: this page will fill itself in as soon as the line is back.
      </p>
    </div>
  );
}
