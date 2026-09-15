/** The dashboards' summaries, and the sidebar counts. */

import { api, type QueryArgs } from "../../shared/lib/api";

export const dashboardApi = {
  badges: (...args: QueryArgs) =>
    api.get("/dashboard/badges", ...args),
  executive: (...args: QueryArgs) =>
    api.get("/dashboard/executive", ...args),
  pendingItems: (...args: QueryArgs) =>
    api.get("/dashboard/pending-items", ...args),
  summary: (...args: QueryArgs) =>
    api.get("/dashboard/summary", ...args),
};
