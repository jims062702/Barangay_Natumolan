/** Calls the shared layer makes itself: the change pulse and the offline register. */

import { api, type QueryArgs } from "./api";

export const systemApi = {
  pulse: (...args: QueryArgs) =>
    api.get("/pulse", ...args),
  offlineRegister: (...args: QueryArgs) =>
    api.get("/residents/offline-sync", ...args),
};
