import axios, { type InternalAxiosRequestConfig } from "axios";
import { isOffline, noteReachable, noteUnreachable } from "./connectivity";

/**
 * What a call site passes to let a write wait for the line.
 *
 *   api.post("/appointments", body, { offline: { label: "Appointment — Juan" } })
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
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: { Accept: "application/json" },
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
    const { enqueue } = await import("./writeQueue");

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
