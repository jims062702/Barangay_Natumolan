import { meta, setMeta } from "./offlineDb";

/**
 * The last answer the server gave, kept for when there is no line.
 *
 * This is for the screens that COUNT things — the dashboard tiles, the
 * certificate report. They cannot be worked out from the device's copy,
 * because the device holds the counter's own recent rows and not the whole
 * barangay's, and a number that is quietly wrong is worse on a dashboard
 * than anywhere else.
 *
 * So the figures are not recalculated offline: the last ones the server
 * gave are shown again, and the caller is told they are old so the screen
 * can say when they were true. That is the honest reading of "no
 * connection" — the work carries on, and the counts are as of the last time
 * anybody could see them. Before this they all read 0, which is not "we
 * cannot say": it is a claim that there is nothing to do.
 *
 * A REFUSAL is not a lost line and is thrown on as it is — an office that
 * may not see a figure must not be handed the last one that was.
 */
export interface LastSeen<T> {
  data: T | null;
  /** True when this came from the device rather than from the server. */
  stale: boolean;
  /** When the server last gave it, for the line that says so. */
  at: string | null;
}

export async function lastSeen<T>(
  key: string,
  request: () => Promise<{ data: { data: T }; fromCache?: boolean; cachedAt?: string }>,
): Promise<LastSeen<T>> {
  const store = `seen.${key}`;

  try {
    const response = await request();
    const data = response.data.data;

    /*
     * The client answers a GET from the device when there is no line, so a
     * resolved promise is not proof of a live answer. Marked responses are
     * reported as what they are.
     */
    const held = response as { fromCache?: boolean; cachedAt?: string };

    if (held.fromCache) {
      return { data, stale: true, at: held.cachedAt ?? null };
    }

    void setMeta(store, { data, at: new Date().toISOString() });

    return { data, stale: false, at: null };
  } catch (error) {
    if ((error as { response?: unknown })?.response) {
      throw error;
    }

    const held = await meta<{ data: T; at: string } | null>(store, null);

    return { data: held?.data ?? null, stale: true, at: held?.at ?? null };
  }
}

/** "as of 2:45 PM, 15 September" — for the line under a figure that is not live. */
export function asOf(at: string | null): string {
  if (!at) {
    return "not since this device was last connected";
  }

  return "as of " + new Date(at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}
