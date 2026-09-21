/** The resident portal: the resident's own requests, cases and profile. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const portalApi = {
  /* Changing the sign-in address: two steps, and the address only moves
     when a code sent TO IT comes back. */
  requestEmailChange: (...args: BodyArgs) =>
    api.post("/portal/profile/email", ...args),
  confirmEmailChange: (...args: BodyArgs) =>
    api.post("/portal/profile/email/confirm", ...args),
  cancelEmailChange: (...args: QueryArgs) =>
    api.delete("/portal/profile/email", ...args),
  /* Their own health record. GET only — it is changed at the station. */
  health: (...args: QueryArgs) =>
    api.get("/portal/health", ...args),
  cases: (...args: QueryArgs) =>
    api.get("/portal/cases", ...args),
  certificateServices: (...args: QueryArgs) =>
    api.get("/portal/certificate-services", ...args),
  dashboard: (...args: QueryArgs) =>
    api.get("/portal/dashboard", ...args),
  family: (...args: QueryArgs) =>
    api.get("/portal/family", ...args),
  profile: (...args: QueryArgs) =>
    api.get("/portal/profile", ...args),
  updateDetails: (...args: BodyArgs) =>
    api.put("/portal/profile/details", ...args),
  requests: (...args: QueryArgs) =>
    api.get("/portal/requests", ...args),
  createRequest: (...args: BodyArgs) =>
    api.post("/portal/requests", ...args),
  cancelRequest: (requestId: PathParam, ...args: BodyArgs) =>
    api.post(`/portal/requests/${requestId}/cancel`, ...args),
  resumeRequest: (requestId: PathParam, ...args: BodyArgs) =>
    api.post(`/portal/requests/${requestId}/resume`, ...args),
};
