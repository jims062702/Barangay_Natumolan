/**
 * Whether the system can actually be reached — not whether the laptop has WiFi.
 *
 * `navigator.onLine` is the obvious answer and it is close to useless here.
 * It reports whether the machine has a network INTERFACE up, so a laptop
 * joined to the barangay hall's router reads "online" the whole time the
 * ISP is down. That is precisely the case this system exists for, and it is
 * the one case navigator.onLine gets wrong.
 *
 * It is still worth listening to, because it is instant and it is right in
 * one direction: when it says OFFLINE, the machine really has no network.
 * When it says online it only means "maybe".
 *
 * So: `navigator.onLine === false` is trusted immediately. Everything else
 * is decided by whether a request actually succeeded.
 */

export type Connectivity = "online" | "offline";

type Listener = (state: Connectivity) => void;

const listeners = new Set<Listener>();

/*
 * Optimistic at boot.
 *
 * The alternative — start "offline" and wait for proof — shows every office
 * an offline banner for the first second of every visit, including the
 * ones with a perfectly good line. Being briefly wrong in this direction
 * costs one failed request; being wrong in the other costs trust in the
 * indicator, and an indicator nobody believes is worse than none.
 */
let state: Connectivity = navigator.onLine ? "online" : "offline";

/** When the last request actually reached the server. */
let lastReachedAt: number | null = null;

function publish(next: Connectivity): void {
  if (next === state) {
    return;
  }

  state = next;
  listeners.forEach((listener) => listener(state));
}

/** Called when a request came back — from anywhere, with any status. */
export function noteReachable(): void {
  lastReachedAt = Date.now();
  publish("online");
}

/**
 * Called when a request failed with NO RESPONSE AT ALL.
 *
 * The distinction matters and is easy to get wrong: a 500 is the server
 * telling us it is broken, which means we reached it. Only a request that
 * never came back is evidence of no line.
 */
export function noteUnreachable(): void {
  publish("offline");
}

export function connectivity(): Connectivity {
  return state;
}

export function isOffline(): boolean {
  return state === "offline";
}

/** When the server was last actually reached, for "3 days offline" notices. */
export function lastReached(): number | null {
  return lastReachedAt;
}

export function watchConnectivity(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/*
 * The browser's own events, for the half of the question it answers well.
 *
 * "offline" is believed on the spot — no interface means no server, and
 * waiting for a request to time out would leave the office typing into a
 * screen that still claims to be connected.
 *
 * "online" is NOT believed. It only means an interface came up; whether the
 * ISP is back is a different question, and the next real request answers it.
 */
window.addEventListener("offline", () => publish("offline"));
