import axios, { type InternalAxiosRequestConfig } from "axios";
import { isOffline, noteReachable, noteUnreachable } from "../offline/connectivity";
import { cacheable, rememberRead, rememberedRead } from "../offline/readCache";

/**
 * What a call site passes to let a write wait for the line.
 *
 *   api.post("/certificates", body, { offline: { label: "Clearance — Juan" } })
 *
 * OPT-IN, deliberately. Nothing is queued unless the call asks, so every
 * write that has not been looked at keeps behaving exactly as it did. That
 * matters more than coverage: a write queued blindly returns no real
 * response, and a page that reads the new record's id from that response
 * would carry on with nothing — quietly, and in production.
 */
export interface OfflineOption {
  /** What the office will read in the "Nakapila" list. */
  label: string;
  /** What to say when it is queued rather than sent. */
  message?: string;
}

declare module "axios" {
  interface AxiosRequestConfig {
    offline?: OfflineOption;
  }

  interface AxiosResponse {
    /** True when this answer came off the device rather than the server. */
    fromCache?: boolean;
    /** When the server last gave it. */
    cachedAt?: string;
  }
}

/*
 * Paths that must NEVER be queued, whatever a call site asks for.
 *
 * VAWC: a survivor's case sitting unencrypted in a laptop's IndexedDB is a
 * disclosure no convenience pays for. The server encrypts these fields with
 * a key the browser never holds — queuing them would defeat that entirely.
 *
 * Accounts and roles: a change of who may do what has to be decided by the
 * server at the moment it happens, not replayed later from a device.
 *
 * Checked here, centrally, so one careless opt-in cannot undo it.
 */
const NEVER_QUEUE = [/^\/?vawc(\/|$)/, /^\/?admin(\/|$)/, /^\/?auth(\/|$)/];

function queueable(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method ?? "get").toLowerCase();

  if (!["post", "put", "patch", "delete"].includes(method)) {
    return false;
  }

  const url = String(config.url ?? "");

  return !NEVER_QUEUE.some((pattern) => pattern.test(url));
}

/**
 * Single shared API client. The token is attached from localStorage on every
 * request; a 401 on a request that carried one clears the session and returns
 * the user to /login. A 401 on a request that carried no token is left alone —
 * it is about that endpoint, not about who is signed in.
 */
function normalizeStorageUrls<T>(data: T): T {
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data;
  }
  if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
    return data;
  }
  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return data;
  }
  if (typeof data === "string") {
    if (data.startsWith("http://localhost:8000/storage/") || data.startsWith("http://127.0.0.1:8000/storage/")) {
      return data.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, "") as unknown as T;
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(normalizeStorageUrls) as unknown as T;
  }
  if (data !== null && typeof data === "object") {
    if (Object.prototype.toString.call(data) !== "[object Object]") {
      return data;
    }
    const copy: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      copy[key] = normalizeStorageUrls(val);
    }
    return copy as T;
  }
  return data;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { Accept: "application/json", "X-Tunnel-Skip-Anti-Abuse-Page": "true" },
});

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  /*
   * A write that asked to wait, with no line to send it on.
   *
   * It is put in the queue and the request never leaves: the adapter is
   * swapped for one that answers immediately, so the calling page gets a
   * normal-looking success and carries on. `queued: true` and a null `data`
   * say what really happened, for any page that needs to know.
   *
   * 202, not 201: accepted for later, not created. The distinction is the
   * whole truth of the situation.
   */
  if (config.offline && isOffline() && queueable(config)) {
    /* Imported here, not at the top: the queue sends through this very
       client, and a top-level import would be a cycle. */
    const { enqueue } = await import("../offline/writeQueue");

    const job = await enqueue(
      config.method!.toLowerCase() as "post" | "put" | "patch" | "delete",
      String(config.url),
      config.data,
      config.offline.label,
    );

    const message = config.offline.message
      ?? "Saved on this device. It will be sent when the connection returns — see Pending sync.";

    config.adapter = async () => ({
      data: { success: true, message, data: null, queued: true, job: job.id },
      status: 202,
      statusText: "Accepted",
      headers: {},
      config,
    });
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    /* It came back, so the line is up. */
    noteReachable();

    if (response.data) {
      response.data = normalizeStorageUrls(response.data);
    }

    /*
     * Kept for the next time there is no line.
     *
     * Not awaited: the page has its answer and must not wait on a write to
     * IndexedDB to render it.
     */
    if (cacheable(response.config)) {
      void rememberRead(response.config, response.data);
    }

    return response;
  },
  (error) => {
    /*
     * No response AT ALL means no line. A 500 is not that — a 500 is the
     * server answering, badly, which proves it was reached. Confusing the
     * two would put the office into offline mode every time a bug on the
     * server threw, and queue work that should have been reported instead.
     */
    if (!error.response) {
      noteUnreachable();

      /*
       * No line, but the device has read this screen before.
       *
       * Answered from that copy rather than rejected, so every office keeps
       * working the way the counter does — the health station's visit list,
       * the Lupon's docket, the session record. The answer is MARKED, so a
       * page that wants to say "these are the last figures the office could
       * see" can, and so nothing downstream mistakes it for live.
       *
       * What is never kept this way — the VAWC desk, accounts, the chat desk,
       * the resident portal — is listed in readCache.ts, with the reason for
       * each.
       */
      if (error.config && cacheable(error.config)) {
        return rememberedRead(error.config).then((held) => {
          if (!held) {
            return Promise.reject(error);
          }

          return {
            data: held.data,
            status: 200,
            statusText: "OK (from this device)",
            headers: {},
            config: error.config,
            fromCache: true,
            cachedAt: held.at,
          };
        });
      }

      return Promise.reject(error);
    }

    noteReachable();

    /*
     * Only a request that actually CARRIED the session can say the session is
     * over. A 401 from a call made without a token means that endpoint wanted
     * an account we never sent — a public page asking for something it should
     * not, a widget polling on a signed-out visitor — and treating it as an
     * expired session logged people out of tabs they were working in.
     *
     * Clearing the token is destructive and silent, so it needs the stronger
     * evidence: we presented a token, and the server refused it.
     */
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem("authToken");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Standard backend envelope: { success, message, data }. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Laravel paginator shape. */
export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Per-field validation errors from a 422, e.g. { email: "…already taken" }. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (axios.isAxiosError(err)) {
    const errs = (err.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors;
    if (errs) {
      return Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, v?.[0] ?? ""]));
    }
  }
  return {};
}

/** Human-readable message from any thrown API error. */
export function errorMessage(err: unknown): string {
  /*
   * No response at all, with the line down: say THAT, not "Network Error".
   *
   * Most of the app's writes are queued offline now. The ones that are not
   * are the ones that genuinely cannot be — a Lupon case, which mints its own
   * number; website content with photos attached — and every one of them
   * reported the line being down as "Network Error", which tells a clerk
   * neither what went wrong nor that nothing was lost.
   *
   * One place, so every page that already shows `errorMessage(err)` gets the
   * honest version without being touched.
   */
  if (axios.isAxiosError(err) && !err.response && isOffline()) {
    return "No connection. This action needs the internet — "
      + "try again when the connection returns. Nothing was saved or lost.";
  }

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    if (data?.errors) {
      const first = Object.values(data.errors)[0];
      if (first?.length) return first[0];
    }
    if (data?.message) return data.message;
    return err.message;
  }
  return "Something went wrong";
}

/*
 * The shape of an endpoint function in a feature's api module.
 *
 * Each one builds its URL and passes everything else straight to the client,
 * so these are simply the client's own parameters after the URL.
 */
type AfterUrl<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

/** A value put into a URL path: an id, a code, a reference. */
export type PathParam = string | number;

/** What a GET or DELETE takes after its URL: the request config. */
export type QueryArgs = AfterUrl<Parameters<typeof api.get>>;

/** What a POST, PUT or PATCH takes after its URL: the body, then the request config. */
export type BodyArgs = AfterUrl<Parameters<typeof api.post>>;
