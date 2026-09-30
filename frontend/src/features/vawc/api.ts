/** The VAWC desk. Confidential: never cached, never queued. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const vawcApi = {
  /* The ONE dialogue a case may have. Saving again corrects that record —
     the table cannot hold a second. */
  agreement: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/vawc/cases/${caseId}/agreement`, ...args),
  recordAgreement: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/agreement`, ...args),
  /* Barangay Protection Orders: a new application, or with renewal_of_id a
     renewal; and moving one along. */
  recordProtectionOrder: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/protection-orders`, ...args),
  updateProtectionOrder: (caseId: PathParam | undefined, orderId: PathParam, ...args: BodyArgs) =>
    api.put(`/vawc/cases/${caseId}/protection-orders/${orderId}`, ...args),
  /* One of each per case; saving again corrects it. */
  saveAssessment: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/assessment`, ...args),
  saveChildWelfare: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/vawc/cases/${caseId}/child-welfare`, ...args),
  updateCaseReferral: (caseId: PathParam | undefined, referralId: PathParam, ...args: BodyArgs) =>
    api.put(`/vawc/cases/${caseId}/referrals/${referralId}`, ...args),
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
  /* The printed forms. The cases report carries names and is written to
     each case's access trail every time it is drawn up. */
  casesReport: (...args: QueryArgs) =>
    api.get("/vawc/reports/cases", ...args),
  dataCapture: (...args: QueryArgs) =>
    api.get("/vawc/reports/data-capture", ...args),
  /* Reports residents sent online: the queue, one opened (logged), verified or declined. */
  onlineReports: (...args: QueryArgs) =>
    api.get("/vawc/online-reports", ...args),
  onlineReport: (reportId: PathParam, ...args: QueryArgs) =>
    api.get(`/vawc/online-reports/${reportId}`, ...args),
  acceptOnlineReport: (reportId: PathParam, ...args: BodyArgs) =>
    api.post(`/vawc/online-reports/${reportId}/accept`, ...args),
  declineOnlineReport: (reportId: PathParam, ...args: BodyArgs) =>
    api.post(`/vawc/online-reports/${reportId}/decline`, ...args),
  /* The Annual Accomplishment Report — counts only, no names. */
  annualReport: (...args: QueryArgs) =>
    api.get("/vawc/reports/annual", ...args),
};
