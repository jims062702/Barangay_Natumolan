/** Sessions of the Sangguniang Barangay, and the officials. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const councilApi = {
  sessions: (...args: QueryArgs) =>
    api.get("/sessions", ...args),
  createSession: (...args: BodyArgs) =>
    api.post("/sessions", ...args),
  session: (sessionId: PathParam, ...args: QueryArgs) =>
    api.get(`/sessions/${sessionId}`, ...args),
  updateSession: (sessionId: PathParam, ...args: BodyArgs) =>
    api.put(`/sessions/${sessionId}`, ...args),
  adoptSession: (sessionId: PathParam, ...args: BodyArgs) =>
    api.post(`/sessions/${sessionId}/adopt`, ...args),
  officials: (...args: QueryArgs) =>
    api.get("/sk/officials", ...args),
  createOfficial: (...args: BodyArgs) =>
    api.post("/sk/officials", ...args),
  updateOfficial: (officialId: PathParam, ...args: BodyArgs) =>
    api.post(`/sk/officials/${officialId}`, ...args),
  deleteOfficial: (officialId: PathParam, ...args: QueryArgs) =>
    api.delete(`/sk/officials/${officialId}`, ...args),
};
