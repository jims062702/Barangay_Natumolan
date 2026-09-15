import { useEffect, useRef, useState } from "react";
import { syncResidents, cacheStatus } from "./residentCache";
import { watchConnectivity } from "./connectivity";
import { flush } from "./writeQueue";

/**
 * Keeps the device's copy of the register current, in the background.
 *
 * WHEN IT RUNS. Once when an office signs in, and again the moment the line
 * comes back. Not on a timer: the register changes a few dozen times a day
 * at most, and a poll would spend the barangay's bandwidth on an answer
 * that is almost always "nothing new".
 *
 * It is deliberately quiet. The clerk did not ask for this and must not be
 * interrupted by it — the only time it says anything is when there is
 * nothing cached at all, because that is the one state where going offline
 * would leave them stranded.
 */
export interface CacheState {
  held: number;
  at: string | null;
  syncing: boolean;
  error: string | null;
}

export function useOfflineData(enabled: boolean): CacheState {
  const [state, setState] = useState<CacheState>({
    held: 0,
    at: null,
    syncing: false,
    error: null,
  });

  /*
   * Guards a second run while one is in flight. Two syncs at once would
   * both page through the register and write the same rows twice — wasted
   * on a line that has none to spare.
   */
  const running = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let alive = true;

    const report = async () => {
      try {
        const status = await cacheStatus();

        if (alive) {
          setState((s) => ({ ...s, held: status.held, at: status.at }));
        }
      } catch {
        /* No IndexedDB — a private window, or site data blocked. The app
           still works online; there is nothing to report and nothing the
           clerk can do about it from here. */
      }
    };

    const sync = async () => {
      if (running.current) {
        return;
      }

      running.current = true;
      setState((s) => ({ ...s, syncing: true, error: null }));

      try {
        const result = await syncResidents();

        if (alive) {
          setState({ held: result.held, at: result.at, syncing: false, error: null });
        }
      } catch (error) {
        if (alive) {
          setState((s) => ({
            ...s,
            syncing: false,
            /*
             * Kept, not shown by default. A failed sync while the line is
             * already down is expected and unremarkable; it only matters
             * when somebody goes looking for why the cache is old.
             */
            error: error instanceof Error ? error.message : "The register could not be fetched.",
          }));
        }
      } finally {
        running.current = false;
      }
    };

    void report();
    void sync();

    /*
     * And send anything the office did while signed out.
     *
     * The queue flushes when the line COMES BACK — but somebody returning
     * after a long outage is often sent to sign in again first, and by the
     * time they are back in, the line has been up the whole while. There is
     * no change left to notice, so without this the work sat in the queue
     * until somebody happened to press "Ipadala".
     */
    void flush();

    /* And again whenever the line comes back — that is the moment the copy
       is most out of date and the bandwidth is available to fix it. */
    const stop = watchConnectivity((next) => {
      if (next === "online") {
        void sync();
      }
    });

    return () => {
      alive = false;
      stop();
    };
  }, [enabled]);

  return state;
}
