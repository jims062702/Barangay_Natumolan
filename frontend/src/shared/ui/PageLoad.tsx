import { useCallback, useMemo, useRef, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { errorMessage } from "../lib/api";
import RouteSkeleton from "./RouteSkeleton";

/**
 * A page's FIRST load — the one thing that decides between its skeleton and
 * the page.
 *
 * ONE LOADING STATE PER NAVIGATION. The page used to arrive in three
 * drawings: the route's skeleton while its code downloaded, then the page's
 * own heading over a second, different skeleton (pulsing table rows, a
 * dashboard grid of another shape) while its data came, then the page. Now
 * the page, until its first answer, draws the SAME skeleton the route drew —
 * RouteSkeleton, chosen from the address — so the two waits are one, and the
 * page appears once, whole.
 *
 * Only the first answer counts. After it, a filter, a search, a new page of
 * results or a background refresh keeps the page on screen; a list shows
 * its own rows loading, never the whole page again.
 *
 * A first load that FAILS ends the skeleton too — with what went wrong and a
 * way to try again. A skeleton that never ends is a page that never loads.
 */
export type PageLoadState = "loading" | "ready" | "failed";

export interface PageLoad {
  state: PageLoadState;
  error: unknown;
  /** The first answer arrived: the page, from now on. */
  done: () => void;
  /** The first answer was a failure. Ignored once the page has shown. */
  fail: (error?: unknown) => void;
  /** Back to the skeleton, for "Try again". */
  retry: () => void;
}

export function usePageLoad(): PageLoad {
  const [state, setState] = useState<PageLoadState>("loading");
  const [error, setError] = useState<unknown>(null);
  /* Once shown, the page stays: a later failure is a refresh that failed,
     not a page that never loaded. */
  const shown = useRef(false);

  const done = useCallback(() => {
    shown.current = true;
    setState("ready");
  }, []);
  const fail = useCallback((err?: unknown) => {
    if (shown.current) return;
    setError(err ?? null);
    setState("failed");
  }, []);
  const retry = useCallback(() => {
    setError(null);
    setState("loading");
  }, []);

  return useMemo(() => ({ state, error, done, fail, retry }), [state, error, done, fail, retry]);
}

/**
 * A page whose first screen needs several SEPARATE loads — a report and the
 * list under it, each with its own effect. Ready when every one is; failed
 * as soon as one is; "Try again" puts them all back to loading.
 */
export function combineLoads(...loads: PageLoad[]): PageLoad {
  const failed = loads.find((l) => l.state === "failed");
  const state: PageLoadState = failed ? "failed" : loads.every((l) => l.state === "ready") ? "ready" : "loading";

  return {
    state,
    error: failed?.error ?? null,
    done: () => undefined,
    fail: () => undefined,
    retry: () => loads.forEach((l) => l.retry()),
  };
}

/**
 * For a page that asks several things at once (Promise.allSettled): the page
 * if ANYTHING answered — a dashboard with one tile at zero is still a
 * dashboard — and the error only if nothing did.
 */
export function settleAll(load: PageLoad, results: PromiseSettledResult<unknown>[]): void {
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

  if (results.length > 0 && failures.length === results.length) {
    load.fail(failures[0].reason);
  } else {
    load.done();
  }
}

/**
 * What a page shows until its first answer: its skeleton, or — if that
 * answer was a failure — the reason and "Try again".
 *
 *     if (page.state !== "ready") return <PageLoading load={page} onRetry={load} />;
 */
export function PageLoading({ load, onRetry }: { load: PageLoad; onRetry: () => void }) {
  if (load.state !== "failed") return <RouteSkeleton />;

  /* A record that is not there, or not this account's to open, is not
     something "Try again" fixes — and the server's own wording for those
     names its database tables. */
  const status = (load.error as { response?: { status?: number } } | null)?.response?.status;
  const missing = status === 404;
  const message = missing
    ? "This record could not be found. It may have been removed, or the link is wrong."
    : status === 403
      ? "Your account is not allowed to open this."
      : errorMessage(load.error);

  return (
    <div role="alert" data-page-error className="rounded-2xl border border-gray bg-white px-6 py-12 text-center shadow-sm">
      <p className="text-base font-semibold text-dark">{missing ? "Record not found" : "This page could not be loaded."}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{message}</p>
      {!missing && status !== 403 && <button
        type="button"
        onClick={() => {
          load.retry();
          onRetry();
        }}
        className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        <FiRefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
      </button>}
    </div>
  );
}
