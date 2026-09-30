/** The signed-in account's notifications. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const accountApi = {
  notifications: (...args: QueryArgs) =>
    api.get("/notifications", ...args),
  markAllNotificationsRead: (...args: BodyArgs) =>
    api.post("/notifications/read-all", ...args),
  markNotificationRead: (notificationId: PathParam, ...args: BodyArgs) =>
    api.post(`/notifications/${notificationId}/read`, ...args),
};
