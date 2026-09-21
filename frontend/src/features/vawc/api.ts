/** The VAWC desk. Confidential: never cached, never queued. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const vawcApi = {
  /* The ONE session a case gets, and what was agreed at it. Saving again
     corrects that record — the table cannot hold a second. */
  agreement: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/vawc/cases/${caseId}/agreement`, ...args),
  recordAgreement: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/agreement`, ...args),
  accessLogs: (...args: QueryArgs) =>
    api.get("/vawc/access-logs", ...args),
  cases: (...args: QueryArgs) =>
    api.get("/vawc/cases", ...args),
  openCase: (...args: BodyArgs) =>
    api.post("/vawc/cases", ...args),
  caseFile: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/vawc/cases/${caseId}`, ...args),
  updateCase: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.put(`/vawc/cases/${caseId}`, ...args),
  addReferral: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/referrals`, ...args),
  recordFollowup: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/followup`, ...args),
  addDocument: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/documents`, ...args),
  documents: (...args: QueryArgs) =>
    api.get("/vawc/documents", ...args),
  updateDocument: (documentId: PathParam, ...args: BodyArgs) =>
    api.put(`/vawc/documents/${documentId}`, ...args),
  followups: (...args: QueryArgs) =>
    api.get("/vawc/followups", ...args),
  referrals: (...args: QueryArgs) =>
    api.get("/vawc/referrals", ...args),
  updateReferral: (referralId: PathParam, ...args: BodyArgs) =>
    api.put(`/vawc/referrals/${referralId}`, ...args),
  statistics: (...args: QueryArgs) =>
    api.get("/vawc/reports/statistics", ...args),
};
