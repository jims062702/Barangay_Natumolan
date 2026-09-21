/** The Population Office: households, events, sectors, portal accounts and analytics. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const populationApi = {
  accounts: (...args: QueryArgs) =>
    api.get("/population/accounts", ...args),
  /* Reading is open to every office — the registry intake and the census
     both ask where somebody lives. Only the KEEPING of the list moved to
     the Health Station, whose own staff the BHWs are. */
  zones: (...args: QueryArgs) =>
    api.get("/zones", ...args),
  createZone: (...args: BodyArgs) =>
    api.post("/health/zones", ...args),
  updateZone: (zoneId: PathParam, ...args: BodyArgs) =>
    api.put(`/health/zones/${zoneId}`, ...args),
  deleteZone: (zoneId: PathParam, ...args: QueryArgs) =>
    api.delete(`/health/zones/${zoneId}`, ...args),
  createBhw: (...args: BodyArgs) =>
    api.post("/health/bhws", ...args),
  updateBhw: (bhwId: PathParam, ...args: BodyArgs) =>
    api.put(`/health/bhws/${bhwId}`, ...args),
  deleteBhw: (bhwId: PathParam, ...args: QueryArgs) =>
    api.delete(`/health/bhws/${bhwId}`, ...args),
  resendActivation: (userId: PathParam, ...args: BodyArgs) =>
    api.post(`/population/accounts/${userId}/resend-activation`, ...args),
  analytics: (...args: QueryArgs) =>
    api.get("/population/analytics", ...args),
  events: (...args: QueryArgs) =>
    api.get("/population/events", ...args),
  recordEvent: (...args: BodyArgs) =>
    api.post("/population/events", ...args),
  verifyEvent: (eventId: PathParam, ...args: BodyArgs) =>
    api.put(`/population/events/${eventId}/verify`, ...args),
  households: (...args: QueryArgs) =>
    api.get("/population/households", ...args),
  createHousehold: (...args: BodyArgs) =>
    api.post("/population/households", ...args),
  updateHousehold: (householdId: PathParam, ...args: BodyArgs) =>
    api.put(`/population/households/${householdId}`, ...args),
  sectoralReport: (...args: QueryArgs) =>
    api.get("/population/reports/sectoral", ...args),
  createResidentAccount: (residentId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/population/residents/${residentId}/create-account`, ...args),
  sectorList: (sector: PathParam, ...args: QueryArgs) =>
    api.get(`/population/sectors/${sector}`, ...args),
  verifyResident: (...args: QueryArgs) =>
    api.get("/population/verify-resident", ...args),
};
