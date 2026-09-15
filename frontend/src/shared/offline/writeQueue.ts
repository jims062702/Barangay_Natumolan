import { api } from "../lib/api";
import { db, STORE_QUEUE, STORE_META, meta, setMeta } from "./offlineDb";
import { isOffline, watchConnectivity } from "./connectivity";

/**
 * Work done with no line, kept until the server has it.
 *
 * Up to here offline mode could show things. This is the half that lets the
 * office DO things: the clerk files a certificate, the form closes, and the
 * request waits on the device until there is somewhere to send it.
 *
 * THE PROMISE THIS MAKES. Once a job is in here it is not lost — not by a
 * refresh, not by closing the browser, not by the laptop dying. It is
 * written to IndexedDB before the caller is told the work was accepted, and
 * it stays there until the SERVER confirms, not merely until it was sent.
 *
 * THE PROMISE IT DOES NOT MAKE. A queued job has not been validated. The
 * server may still refuse it — a resident matched to somebody already
 * registered, a household number that does not exist — and that refusal
 * arrives hours later, with the resident long gone. Those land in a list a
 * person has to look at. Silently dropping them would be the worst failure
 * this system could have: work the office believes is done and is not.
 */

const STORE = STORE_QUEUE;

export interface QueuedJob {
  /*
   * Made on the DEVICE, before anything is sent.
   *
   * This is what makes a retry safe. A request can be sent, arrive, and the
   * reply lost on the way back — so the device cannot tell "it did not
   * happen" from "it happened and I did not hear". Sending the same id
   * again lets the SERVER tell them apart and refuse the second one, which
   * is the only place that knowledge exists.
   */
  id: string;
  method: "post" | "put" | "patch" | "delete";
  path: string;
  body: unknown;
  /** What this was, in words, for the list a person reads. */
  label: string;
  /** When the clerk did it — not when it synced. */
  createdAt: number;
  attempts: number;
  /** Set when the server refused it; cleared if a person fixes and retries. */
  problem: string | null;
  status: "waiting" | "sending" | "failed";
}

type Listener = (jobs: QueuedJob[]) => void;

const listeners = new Set<Listener>();

function announce(jobs: QueuedJob[]): void {
  listeners.forEach((listener) => listener(jobs));
}

export function watchQueue(listener: Listener): () => void {
  listeners.add(listener);

  void allJobs().then(listener);

  return () => {
    listeners.delete(listener);
  };
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("The write was rolled back."));
  });
}

export async function allJobs(): Promise<QueuedJob[]> {
  try {
    const handle = await db();
    const rows = await request<QueuedJob[]>(
      handle.transaction(STORE, "readonly").objectStore(STORE).getAll(),
    );

    /* Oldest first. The office did them in an order and some of them depend
       on it — a household made before the people put in it. */
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function write(job: QueuedJob): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(STORE, "readwrite");

  tx.objectStore(STORE).put(job);

  await committed(tx);
}

async function drop(id: string): Promise<void> {
  const handle = await db();
  const tx = handle.transaction(STORE, "readwrite");

  tx.objectStore(STORE).delete(id);

  await committed(tx);
}

/** A device-unique id. */
function newId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  /* Older browsers. Random bytes rather than Math.random, which is not
     unique enough to hang an idempotency guarantee on. */
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Takes a job, writes it down, and tries to send it.
 *
 * Written BEFORE sending, always — including when the line is up. A request
 * that leaves and never arrives is indistinguishable from one that was
 * never made, and the only way the work survives that is if it was recorded
 * first.
 */
export async function enqueue(
  method: QueuedJob["method"],
  path: string,
  body: unknown,
  label: string,
): Promise<{ queued: true; id: string }> {
  const job: QueuedJob = {
    id: newId(),
    method,
    path,
    body,
    label,
    createdAt: Date.now(),
    attempts: 0,
    problem: null,
    status: "waiting",
  };

  await write(job);
  announce(await allJobs());

  /* Sent straight away when there is a line — the queue is a safety net,
     not a delay. Nothing waits on the result. */
  if (!isOffline()) {
    void flush();
  }

  return { queued: true, id: job.id };
}

let flushing = false;

/**
 * Sends everything waiting, oldest first.
 *
 * IN ORDER AND ONE AT A TIME. A household created offline and the people
 * put in it are two jobs with a dependency between them, and sending them
 * together would land the members before the household exists. Slower, and
 * correct.
 */
export async function flush(): Promise<{ sent: number; failed: number }> {
  if (flushing || isOffline()) {
    return { sent: 0, failed: 0 };
  }

  flushing = true;

  let sent = 0;
  let failed = 0;

  try {
    for (const job of await allJobs()) {
      /* Already refused by the server. Retrying it unchanged would fail the
         same way for ever; it needs a person. */
      if (job.status === "failed") {
        continue;
      }

      await write({ ...job, status: "sending", attempts: job.attempts + 1 });
      announce(await allJobs());

      try {
        await api.request({
          method: job.method,
          url: job.path,
          data: job.body,
          /* The id the SERVER uses to recognise a repeat. */
          headers: { "X-Offline-Job": job.id },
        });

        await drop(job.id);
        sent += 1;
      } catch (error) {
        const response = (error as { response?: { status: number; data?: { message?: string } } })
          .response;

        if (!response) {
          /*
           * The line went down mid-flush. NOT a failure — the job is put
           * back exactly as it was and the whole run stops, because
           * everything after it would fail the same way and burn an attempt
           * each.
           */
          await write({ ...job, status: "waiting", attempts: job.attempts });
          break;
        }

        /*
         * The server answered and refused. That is a decision, not a
         * network problem, and repeating it will not change it. It is kept
         * with the reason attached, for somebody to look at.
         */
        await write({
          ...job,
          status: "failed",
          problem: response.data?.message ?? `The server refused this (${response.status}).`,
        });
        failed += 1;
      }

      announce(await allJobs());
    }
  } finally {
    flushing = false;
  }

  await setMeta("queue.last_flush", Date.now());

  return { sent, failed };
}

/**
 * Changes what a job still waiting will send.
 *
 * For work that moves on before it is sent. A walk-in served with no line is
 * filed, then printed, then handed over — all in one sitting, all before the
 * internet returns. Rather than three jobs where the second and third point
 * at a certificate the server has never heard of, the one job is updated as
 * the certificate moves, and arrives saying how far it got.
 *
 * Refused for a job already on its way: a body changed mid-send would leave
 * the server and the device disagreeing about which version it received.
 */
export async function updateJobBody(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const job = (await allJobs()).find((j) => j.id === id);

  if (!job || job.status === "sending") {
    return false;
  }

  await write({ ...job, body: { ...(job.body as Record<string, unknown>), ...patch } });
  announce(await allJobs());

  return true;
}

/** Puts a refused job back in line, after somebody has looked at it. */
export async function retry(id: string): Promise<void> {
  const jobs = await allJobs();
  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return;
  }

  await write({ ...job, status: "waiting", problem: null });
  announce(await allJobs());

  void flush();
}

/**
 * Throws a job away. Only ever from a person deciding to.
 *
 * Nothing in this module discards work on its own — a job the server
 * refused stays until somebody says otherwise, because the alternative is
 * the office believing something was filed when it was not.
 */
export async function discard(id: string): Promise<void> {
  await drop(id);
  announce(await allJobs());
}

/**
 * The jobs still waiting that were aimed at one endpoint.
 *
 * So a list can show work the office has done but the server has not seen.
 * Without it the clerk files a certificate offline, is told it was recorded,
 * opens the very list it belongs in — and finds it empty. Nothing has gone
 * wrong, and every signal on the screen says otherwise.
 */
export async function pendingFor(path: string): Promise<QueuedJob[]> {
  return (await allJobs()).filter((job) => job.path === path && job.status !== "failed");
}

/** When the queue was last emptied, for the status line. */
export async function lastFlush(): Promise<number | null> {
  return meta<number | null>("queue.last_flush", null);
}

export { STORE as QUEUE_STORE, STORE_META };

/* The line coming back is the moment to try again, and the only signal that
   does not cost anything to watch. */
watchConnectivity((state) => {
  if (state === "online") {
    void flush();
  }
});
