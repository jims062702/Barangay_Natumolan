import type { InternalAxiosRequestConfig } from "axios";
import { meta, setMeta, remove, STORE_META } from "./offlineDb";

/**
 * The last answer the server gave each page, kept so the office can read
 * with no line.
 *
 * Every office works offline, not only the counter. A health worker with a
 * dead line still has to see this morning's visits; the Lupon secretary
 * still has to see which hearing is tomorrow. Written per screen that would
 * have been a screen per page of code and a screen the next page forgot, so
 * it is done once here: a GET that succeeds is remembered, and a GET that
 * finds no line is answered from what was remembered — marked, so the page
 * can say the figures are the last ones seen.
 *
 * WHAT IS NEVER KEPT, and why:
 *
 *   vawc      a survivor's case on a laptop's disk is a disclosure. The
 *             server encrypts these fields with a key the browser never
 *             holds; caching them here would hand them over in the clear.
 *   admin     who may do what is the server's to decide, every time.
 *   auth      a session is not a document to be read from a copy.
 *   portal    residents are not offline users: the portal is for people at
 *             home with a phone, and a stale certificate status there is a
 *             promise the barangay did not make.
 *   chat      a conversation read from yesterday's copy is worse than a
 *             page saying the desk cannot be reached.
 *   pulse     "has anything changed?" answered from a cache is a lie by
 *             construction.
 *   resident-id, residents/{id}/card
 *             a Resident ID's code is what makes the card verify; it is not
 *             written to a laptop's disk.
 *   assistant/allowance
 *             how many chatbot messages are left today — a count read from
 *             an old copy is a wrong count.
 *   certificates, residents/offline-sync, population/verify-resident
 *             these have their own offline answers, which are better than a
 *             cached one: the counter list merges in what was filed while the
 *             line was down, and Records Verification searches the whole
 *             register held here rather than one remembered search.
 */
const NEVER_CACHE = [
  /^\/?vawc(\/|$)/,
  /^\/?admin(\/|$)/,
  /^\/?auth(\/|$)/,
  /^\/?portal(\/|$)/,
  /^\/?chat(\/|$)/,
  /^\/?pulse(\/|$)/,
  /^\/?assistant\/allowance(\/|$)/,
  /^\/?resident-id(\/|$)/,
  /^\/?residents\/[^/]+\/card(\/|$)/,
  /^\/?resident-cards(\/|$)/,
  /^\/?verify(\/|$)/,
  /^\/?certificates(\/|$)/,
  /^\/?residents\/offline-sync(\/|$)/,
  /^\/?population\/verify-resident(\/|$)/,
];

/** How many screens' worth to keep. Older entries are dropped, oldest first. */
const LIMIT = 200;
const INDEX = "read.index";

export interface SeenResponse {
  data: unknown;
  at: string;
}

export function cacheable(config: InternalAxiosRequestConfig): boolean {
  if ((config.method ?? "get").toLowerCase() !== "get") return false;

  const url = String(config.url ?? "");

  return !NEVER_CACHE.some((pattern) => pattern.test(url));
}

/** One key per screen: the path and the question it asked. */
export function readKey(config: InternalAxiosRequestConfig): string {
  const params = config.params ? JSON.stringify(config.params) : "";

  return `read.${String(config.url ?? "")}${params ? "?" + params : ""}`;
}

export async function rememberRead(config: InternalAxiosRequestConfig, data: unknown): Promise<void> {
  try {
    const key = readKey(config);
    await setMeta(key, { data, at: new Date().toISOString() } satisfies SeenResponse);

    /* An index, so the oldest can be dropped rather than the device filling. */
    const index = (await meta<string[]>(INDEX, [])) ?? [];
    const next = [...index.filter((k) => k !== key), key];

    while (next.length > LIMIT) {
      const oldest = next.shift();
      if (oldest) await remove(STORE_META, oldest);
    }

    await setMeta(INDEX, next);
  } catch {
    /* A device with no IndexedDB still works online, which is what just
       happened. Losing the copy must not fail the request that succeeded. */
  }
}

export async function rememberedRead(config: InternalAxiosRequestConfig): Promise<SeenResponse | null> {
  try {
    return await meta<SeenResponse | null>(readKey(config), null);
  } catch {
    return null;
  }
}
