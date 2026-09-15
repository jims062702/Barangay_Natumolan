/** Barangay Health Station records. */

import { api, type BodyArgs, type QueryArgs } from "../../shared/lib/api";

export const healthApi = {
  childHealth: (...args: QueryArgs) =>
    api.get("/health/child-health", ...args),
  recordChildHealth: (...args: BodyArgs) =>
    api.post("/health/child-health", ...args),
  immunizations: (...args: QueryArgs) =>
    api.get("/health/immunization", ...args),
  recordImmunization: (...args: BodyArgs) =>
    api.post("/health/immunization", ...args),
  maternalHealth: (...args: QueryArgs) =>
    api.get("/health/maternal-health", ...args),
  recordMaternalHealth: (...args: BodyArgs) =>
    api.post("/health/maternal-health", ...args),
  coverageReport: (...args: QueryArgs) =>
    api.get("/health/reports/coverage", ...args),
  visits: (...args: QueryArgs) =>
    api.get("/health/visits", ...args),
  recordVisit: (...args: BodyArgs) =>
    api.post("/health/visits", ...args),
};
