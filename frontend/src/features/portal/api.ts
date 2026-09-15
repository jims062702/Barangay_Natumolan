/** The resident portal: the resident's own requests, appointments, cases and profile. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const portalApi = {
  appointments: (...args: QueryArgs) =>
    api.get("/portal/appointments", ...args),
  bookAppointment: (...args: BodyArgs) =>
    api.post("/portal/appointments", ...args),
  cancelAppointment: (appointmentId: PathParam, ...args: BodyArgs) =>
    api.post(`/portal/appointments/${appointmentId}/cancel`, ...args),
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
  updateOccupation: (...args: BodyArgs) =>
    api.put("/portal/profile/occupation", ...args),
  requests: (...args: QueryArgs) =>
    api.get("/portal/requests", ...args),
  createRequest: (...args: BodyArgs) =>
    api.post("/portal/requests", ...args),
  cancelRequest: (requestId: PathParam, ...args: BodyArgs) =>
    api.post(`/portal/requests/${requestId}/cancel`, ...args),
  resumeRequest: (requestId: PathParam, ...args: BodyArgs) =>
    api.post(`/portal/requests/${requestId}/resume`, ...args),
};
