/** The signed-in account's notifications. */

import { api, type BodyArgs, type QueryArgs } from "../../shared/lib/api";

export const accountApi = {
  notifications: (...args: QueryArgs) =>
    api.get("/notifications", ...args),
  markAllNotificationsRead: (...args: BodyArgs) =>
    api.post("/notifications/read-all", ...args),
};
