/** The dashboards' summaries, and the sidebar counts. */

import { api, type QueryArgs } from "../../shared/lib/api";

export const dashboardApi = {
  badges: (...args: QueryArgs) =>
    api.get("/dashboard/badges", ...args),
  executive: (...args: QueryArgs) =>
    api.get("/dashboard/executive", ...args),
  /* What residents come in for. Read by the counter and by the PB alike. */
  requestedServices: (...args: QueryArgs) =>
    api.get("/dashboard/requested-services", ...args),
  /* Lupon, VAWC and Health in one return — the Secretary writes it and
     the Punong Barangay signs it. */
  consolidatedReport: (...args: QueryArgs) =>
    api.get("/reports/consolidated", ...args),
  pendingItems: (...args: QueryArgs) =>
    api.get("/dashboard/pending-items", ...args),
  summary: (...args: QueryArgs) =>
    api.get("/dashboard/summary", ...args),
};
