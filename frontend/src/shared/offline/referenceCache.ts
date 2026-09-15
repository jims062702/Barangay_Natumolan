import { api } from "../lib/api";
import { meta, setMeta } from "./offlineDb";

/**
 * The lists the office picks FROM, kept on the device.
 *
 * The fee schedule, the code lists, the service guide — settings, not
 * records. They change when an ordinance changes, which is to say almost
 * never, and every one of them is fetched fresh on page load.
 *
 * That was fine until the line went down. The New Certificate form asks the
 * server what types exist; with no answer the dropdown came up EMPTY, so a
 * clerk with the resident found, the purpose typed and the fee ready could
 * not choose what to issue. Everything else about offline mode was working
 * and the form was still unusable.
 *
 * Small enough to keep whole, and re-fetched whenever the line is up, so
 * the cached copy is never more than one online visit behind.
 */

/** Fetches, caching the result; falls back to the cache when it cannot. */
export async function cachedGet<T>(path: string, key: string): Promise<T | null> {
  try {
    const response = await api.get(path);
    const data = response.data.data as T;

    /* Stored on every success, not only the first. An ordinance that
       changes the fees has to reach the device that keeps working offline. */
    void setMeta(`ref.${key}`, data);

    return data;
  } catch (error) {
    const fallback = await meta<T | null>(`ref.${key}`, null);

    if (fallback !== null) {
      return fallback;
    }

    /*
     * Nothing cached and nothing fetched. Reported rather than swallowed:
     * the caller has to be able to tell "there are no certificate types"
     * from "we could not find out", because only one of those is worth
     * putting in front of a clerk.
     */
    throw error;
  }
}

/** What the device holds for a reference list, without asking the server. */
export async function cachedOnly<T>(key: string): Promise<T | null> {
  return meta<T | null>(`ref.${key}`, null);
}
