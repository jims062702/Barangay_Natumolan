import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { isOffline } from "./connectivity";

/**
 * A lazily-loaded screen that survives the two ways a chunk stops loading.
 *
 * Every page in this app arrives as its own file, fetched the first time
 * somebody opens it. That is why the app is quick to start — and it is also
 * why "the app opens offline" and "the pages open offline" are two different
 * claims. The shell can be cached perfectly while /certificates still dies
 * on `Failed to fetch dynamically imported module`.
 *
 * There are exactly two reasons that happens, and they need opposite
 * treatment:
 *
 *   A DEPLOY LANDED. The HTML in this tab names chunks from the build it was
 *   served, and those files are gone — replaced by a new build with new
 *   hashes. Nothing is wrong with the network. One reload picks up the new
 *   HTML and the new worker, and it fixes itself.
 *
 *   THE LINE IS DOWN and this chunk was never cached. Reloading would be the
 *   worst possible move: the page that IS cached would be thrown away for a
 *   navigation that cannot complete, and the clerk loses the tab they were
 *   working in. So it fails, deliberately, with something worth reading.
 *
 * Telling them apart is the whole job here. The old code did neither and
 * showed "This page hit an error" with a stack trace for both.
 */

/** Thrown for the offline case, so the boundary can say something useful. */
export class ChunkUnavailableOffline extends Error {
  constructor() {
    super(
      "This page has not been saved for offline use yet. "
      + "Open it once while connected, and it will work without a connection after that.",
    );
    this.name = "ChunkUnavailableOffline";
  }
}

/*
 * One reload per tab, ever.
 *
 * sessionStorage and not localStorage: the guard should last as long as this
 * tab and no longer. A reload loop is the failure mode that turns a missing
 * file into an unusable machine, and a flag that outlived the session would
 * also stop the ONE reload from working after a later deploy.
 */
const RELOADED = "chunk-reload-attempted";

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOADED) === "1";
  } catch {
    /* Private windows and locked-down browsers throw on access. Treating
       that as "already reloaded" is the safe read: no storage means no way
       to stop a loop, so never start one. */
    return true;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOADED, "1");
  } catch {
    /* Nothing to do. alreadyReloaded() fails closed. */
  }
}

/** Cleared once a chunk loads, so a later deploy gets its own retry. */
function clearReloaded(): void {
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {
    /* As above. */
  }
}

/**
 * What to do about a chunk that would not load.
 *
 * Pulled out as a plain function of two booleans so it can be tested for
 * what it is — a decision — without a browser, a service worker, or a
 * build. The three answers are the three real situations, and getting one
 * wrong is expensive in a different direction each time.
 */
export type ChunkFailure = "offline" | "reload" | "rethrow";

export function decideOnChunkFailure(
  offline: boolean,
  hasReloaded: boolean,
): ChunkFailure {
  /* Offline wins even if a reload has not been tried: reloading with no
     line throws away the cached page for a navigation that cannot finish. */
  if (offline) {
    return "offline";
  }

  /* Online and not yet retried — almost certainly a deploy replaced the
     files this HTML names. One reload fixes it. */
  if (!hasReloaded) {
    return "reload";
  }

  /* Reloaded once and still failing. This is a real fault, not a stale
     build, and hiding it behind another reload would loop forever. */
  return "rethrow";
}

async function load<T>(factory: () => Promise<T>): Promise<T> {
  try {
    const loaded = await factory();

    clearReloaded();

    return loaded;
  } catch (error) {
    const decision = decideOnChunkFailure(isOffline(), alreadyReloaded());

    if (decision === "offline") {
      throw new ChunkUnavailableOffline();
    }

    if (decision === "reload") {
      markReloaded();
      window.location.reload();

      /*
       * Never settles, on purpose. The page is being replaced; resolving or
       * rejecting here would render something for the half-second before
       * the navigation, and what it rendered would be an error nobody needs
       * to see.
       */
      return new Promise<T>(() => {});
    }

    /* "rethrow" — let the real error through so the boundary shows what
       actually happened. */
    throw error;
  }
}

/*
 * `any` here, matching React's own `lazy` signature.
 *
 * `ComponentType<unknown>` looks stricter and is simply wrong: a screen that
 * takes props — UserManagement takes `kind`, several take an id — does not
 * satisfy it, because a component accepting `{kind?: string}` cannot be
 * called with `unknown`. Props are checked at the call site in the routes
 * below, which is where they are actually passed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoute<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => load(factory));
}
