import {
  STORE_RESIDENTS,
  clear,
  count,
  meta,
  putMany,
  readAll,
  requestDurableStorage,
  setMeta,
} from "./offlineDb";
import { systemApi } from "../lib/systemApi";

/**
 * The register, kept on the device so the counter never stops.
 *
 * The clerk's first move on a walk-in is to search for the person standing
 * in front of them. Online that is a round trip; offline it returned
 * nothing, and the screen told the clerk that somebody on the register was
 * not on the register. This is the fix.
 */

/** The lean row the sync endpoint sends. */
export interface CachedResident {
  id: number;
  resident_number: string;
  record_type: string | null;
  life_status: string | null;
  /* Rows cached before it was sent have none; see LAST_SYNC. */
  gender?: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birthdate: string | null;
  birthdate_is_estimated: boolean | null;
  birth_place: string | null;
  nationality?: string | null;
  civil_status: string | null;
  zone_purok: string | null;
  address: string | null;
  length_of_residence_years: number | null;
  contact_number: string | null;
  updated_at: string | null;
}

/** What is actually stored: the row plus the haystack we search. */
interface StoredResident extends CachedResident {
  search: string;
}

/*
 * ".v2": the rows gained `gender`, so a mother can be looked for among women
 * only. A new key makes every device take the register once, whole, instead
 * of only what changed — the rows it already holds would otherwise never
 * learn it.
 */
const LAST_SYNC = "residents.synced_at.v2";
const SERVER_TOTAL = "residents.server_total";

/**
 * Everything a search should match against, lowercased once at write time.
 *
 * Built here rather than at read time because the alternative is rebuilding
 * it for 20,000 rows on every keystroke.
 */
function haystack(r: CachedResident): string {
  return [
    r.first_name,
    r.middle_name,
    r.last_name,
    r.suffix,
    r.resident_number,
    r.zone_purok,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function stored(rows: CachedResident[]): StoredResident[] {
  return rows.map((r) => ({ ...r, search: haystack(r) }));
}

export interface SyncReport {
  pulled: number;
  held: number;
  full: boolean;
  at: string | null;
}

/**
 * Brings the device's copy up to date.
 *
 * FULL the first time and whenever the counts disagree; INCREMENTAL after
 * that. The count check is not belt-and-braces — residents are deleted
 * outright on the server, with no tombstone, so a removed record simply
 * stops appearing and an incremental pull can never mention it. Comparing
 * what we hold against what the server says it has is the only way to
 * notice, and the answer is to start again.
 */
export async function syncResidents(options: { force?: boolean } = {}): Promise<SyncReport> {
  await requestDurableStorage();

  const held = await count(STORE_RESIDENTS);
  const since = options.force ? null : await meta<string | null>(LAST_SYNC, null);

  /* Nothing held yet is the same situation as never synced, whatever the
     bookkeeping says — a cleared browser leaves the timestamp behind. */
  const full = options.force || !since || held === 0;

  let cursor: number | null = null;
  let pulled = 0;
  let serverTime: string | null = null;
  let serverTotal = 0;
  const fresh: CachedResident[] = [];

  /* Paged rather than one call: 20,000 rows in a single response is a
     request the barangay's line does not finish, and a failure halfway
     through leaves nothing to show for the minute it took. */
  do {
    const response = await systemApi.offlineRegister({
      params: {
        limit: 1000,
        cursor: cursor ?? undefined,
        since: full ? undefined : since,
      },
    });

    const data = response.data.data as {
      rows: CachedResident[];
      next_cursor: number | null;
      total: number;
      server_time: string;
    };

    fresh.push(...data.rows);
    pulled += data.rows.length;
    cursor = data.next_cursor;
    serverTime = data.server_time;
    serverTotal = data.total;
  } while (cursor !== null);

  if (full) {
    /*
     * Replaced, not merged. A full pull is the answer to "we do not trust
     * what is here", and merging into a copy we already distrust would keep
     * whatever was wrong with it.
     */
    await clear(STORE_RESIDENTS);
  }

  await putMany(STORE_RESIDENTS, stored(fresh));
  await setMeta(LAST_SYNC, serverTime);
  await setMeta(SERVER_TOTAL, serverTotal);

  const now = await count(STORE_RESIDENTS);

  /*
   * Drift, caught and corrected once.
   *
   * `force` guards the recursion: if a full pull ALSO comes out wrong,
   * something is wrong that pulling again will not fix, and looping would
   * hammer the server instead of surfacing it.
   */
  if (!full && serverTotal > 0 && now !== serverTotal) {
    return syncResidents({ force: true });
  }

  return { pulled, held: now, full, at: serverTime };
}

export interface OfflineSearchOptions {
  /** Only bonafide residents, or only non-residents — as the picker asks. */
  recordType?: "Resident" | "Non-resident";
  /** Only women (or men) — as the server's own filter. */
  gender?: "Female" | "Male";
  limit?: number;
}

/**
 * The same search the server does, run against the device's copy.
 *
 * Deliberately matched to `Resident::scopeNameSearch`: every word must
 * appear somewhere in the name or the resident number. A clerk who types
 * "juan dela cruz" and gets a different list offline than online would
 * stop trusting both.
 */
export async function searchResidentsOffline(
  term: string,
  options: OfflineSearchOptions = {},
): Promise<CachedResident[]> {
  const words = term.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  /* Matched to the server's own limit — see ResidentController::search. */
  const limit = options.limit ?? 25;
  const all = await readAll<StoredResident>(STORE_RESIDENTS);
  const matches: StoredResident[] = [];

  for (const row of all) {
    if (options.recordType === "Resident" && row.record_type === "Non-resident") {
      continue;
    }

    if (options.recordType === "Non-resident" && row.record_type !== "Non-resident") {
      continue;
    }

    if (options.gender && row.gender !== options.gender) {
      continue;
    }

    if (!words.every((word) => row.search.includes(word))) {
      continue;
    }

    matches.push(row);

    /*
     * NOT stopped at the limit here. Sorting has to happen across every
     * match, or the ten that come back are the ten with the lowest ids
     * rather than the ten a person would expect — and the clerk sorting
     * through a register alphabetically would never find them.
     */
  }

  /* Matched to the server's ORDER BY exactly, id included. Without that
     last term the two disagree on which ten survive the cut whenever two
     people share a name. */
  matches.sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name)
      || a.first_name.localeCompare(b.first_name)
      || a.id - b.id,
  );

  return matches.slice(0, limit);
}

/** One resident by id, for a screen opened from a link while offline. */
export async function cachedResident(id: number): Promise<CachedResident | null> {
  const all = await readAll<StoredResident>(STORE_RESIDENTS);

  return all.find((r) => r.id === id) ?? null;
}

/** What the device holds, for the sync indicator. */
export async function cacheStatus(): Promise<{ held: number; at: string | null }> {
  return {
    held: await count(STORE_RESIDENTS),
    at: await meta<string | null>(LAST_SYNC, null),
  };
}
