/**
 * The barangay's own data, stored on the device.
 *
 * IndexedDB rather than localStorage, and the reason is not preference:
 * localStorage holds about 5MB of STRINGS and every read and write blocks
 * the page. The register alone is 20,000 people — several megabytes before
 * anything else — so it would not fit, and the attempt would freeze the
 * screen on every search.
 *
 * Written directly against the browser API. A wrapper library would be one
 * more thing to keep working, and what is needed here is four operations.
 *
 * WHAT MUST NEVER BE STORED HERE: anything from VAWC. Those records are
 * encrypted on the server with a key the browser does not have, and a copy
 * of a survivor's case on an office laptop is a disclosure risk that no
 * amount of convenience pays for. The sync endpoint does not send them and
 * nothing here asks.
 */

const DB_NAME = "natumolan-offline";

/*
 * Bump this when a store or index changes shape, and handle the change in
 * `upgrade` below. Forgetting to bump means the new index is simply absent
 * on every device that has opened the app before — which fails as "search
 * returns nothing", nowhere near the cause.
 */
const DB_VERSION = 2;   // 2: added the write queue

export const STORE_RESIDENTS = "residents";
export const STORE_META = "meta";
export const STORE_QUEUE = "queue";

let open: Promise<IDBDatabase> | null = null;

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_RESIDENTS)) {
    const residents = db.createObjectStore(STORE_RESIDENTS, { keyPath: "id" });

    /*
     * Indexed on a prepared search field rather than on the name columns.
     *
     * The counter searches by any part of a name — "dela cruz", "juan",
     * a resident number — and IndexedDB cannot do "contains" on an index.
     * So each record carries a lowercased haystack built at write time,
     * and the search walks that index once. Doing the lowercasing on read
     * instead would redo it for 20,000 rows on every keystroke.
     */
    residents.createIndex("search", "search", { unique: false });
    residents.createIndex("resident_number", "resident_number", { unique: false });
    residents.createIndex("last_name", "last_name", { unique: false });
  }

  if (!db.objectStoreNames.contains(STORE_META)) {
    db.createObjectStore(STORE_META, { keyPath: "key" });
  }

  if (!db.objectStoreNames.contains(STORE_QUEUE)) {
    /*
     * Work done offline, waiting for somewhere to send it.
     *
     * Keyed on the id the DEVICE made, which is the same id sent to the
     * server — so a job that was sent, arrived, and whose reply was lost
     * can be recognised as a repeat rather than applied twice.
     */
    const queue = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });

    queue.createIndex("createdAt", "createdAt", { unique: false });
    queue.createIndex("status", "status", { unique: false });
  }
}

/**
 * The database, opened once and shared.
 *
 * Rejects rather than throwing synchronously, so every caller can decide
 * what to do without a try/catch around an assignment. Private windows and
 * browsers with site data blocked will land here.
 */
export function db(): Promise<IDBDatabase> {
  if (open) {
    return open;
  }

  open = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser has no IndexedDB, so offline data is not available."));

      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB refused to open."));

    /*
     * Another tab is holding an older version open. Reporting it is better
     * than hanging: the user can close the other tab, and a promise that
     * never settles would leave the page spinning with no explanation.
     */
    request.onblocked = () =>
      reject(new Error("Another tab has this app open on an older version. Close it and reload."));
  });

  /* A failed open must not be cached, or one bad moment disables offline
     for the rest of the session. */
  open.catch(() => {
    open = null;
  });

  return open;
}

/** Wraps one request in a promise. */
function run<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Wraps a transaction, resolving only once it has actually committed. */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    /*
     * `oncomplete`, not the last request's `onsuccess`. A request can
     * succeed and the transaction still abort — on a quota error, most
     * often — and resolving early would report a write that never landed.
     */
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("The write was rolled back."));
  });
}

/** Everything in a store, as an array. */
export async function readAll<T>(store: string): Promise<T[]> {
  const handle = await db();

  return run<T[]>(handle.transaction(store, "readonly").objectStore(store).getAll());
}

/** How many rows a store holds. */
export async function count(store: string): Promise<number> {
  const handle = await db();

  return run<number>(handle.transaction(store, "readonly").objectStore(store).count());
}

/** Writes many rows in ONE transaction. */
export async function putMany<T>(store: string, rows: T[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const handle = await db();
  const tx = handle.transaction(store, "readwrite");
  const target = tx.objectStore(store);

  /*
   * Queued without awaiting each one. IndexedDB runs the requests in order
   * within the transaction, and awaiting each would let the transaction
   * auto-close between them — the classic "TransactionInactiveError" that
   * appears only once the data is big enough to span a tick.
   */
  rows.forEach((row) => target.put(row));

  return committed(tx);
}

export async function put<T>(store: string, row: T): Promise<void> {
  return putMany(store, [row]);
}

export async function remove(store: string, key: IDBValidKey): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(store, "readwrite");

  tx.objectStore(store).delete(key);

  return committed(tx);
}

export async function clear(store: string): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(store, "readwrite");

  tx.objectStore(store).clear();

  return committed(tx);
}

/** A single value from the meta store, or `fallback`. */
export async function meta<T>(key: string, fallback: T): Promise<T> {
  try {
    const handle = await db();
    const row = await run<{ key: string; value: T } | undefined>(
      handle.transaction(STORE_META, "readonly").objectStore(STORE_META).get(key),
    );

    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  return put(STORE_META, { key, value });
}

/**
 * Asks the browser not to evict this data when storage runs short.
 *
 * Without it, IndexedDB is "best-effort": the browser may clear it when the
 * disk fills, which for this app means a clerk finding an empty register
 * mid-outage. Granting it is the browser's decision, not ours — Chrome
 * usually says yes to an installed app — so the result is reported and not
 * relied upon.
 */
export async function requestDurableStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) {
      return false;
    }

    if (await navigator.storage.persisted()) {
      return true;
    }

    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
