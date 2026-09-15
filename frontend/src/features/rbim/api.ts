/** The RBIM baseline census. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const rbimApi = {
  censuses: (...args: QueryArgs) =>
    api.get("/rbim", ...args),
  createCensus: (...args: BodyArgs) =>
    api.post("/rbim", ...args),
  census: (censusId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/rbim/${censusId}`, ...args),
  updateCensus: (censusId: PathParam | undefined, ...args: BodyArgs) =>
    api.put(`/rbim/${censusId}`, ...args),
  matchMember: (censusId: PathParam, memberId: PathParam, ...args: BodyArgs) =>
    api.put(`/rbim/${censusId}/members/${memberId}`, ...args),
  submitCensus: (censusId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/rbim/${censusId}/submit`, ...args),
  checkEmail: (...args: QueryArgs) =>
    api.get("/rbim/check-email", ...args),
  codeLists: (...args: QueryArgs) =>
    api.get("/rbim/code-lists", ...args),
  verifyHousehold: (...args: QueryArgs) =>
    api.get("/rbim/verify-household", ...args),
};
