/** The Lupon Tagapamayapa docket: cases, hearings, settlements, reports. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const luponApi = {
  /* Fees: the Lupon asks, the Clerk takes. */
  payments: (...args: QueryArgs) =>
    api.get("/lupon/payments", ...args),
  requestPayment: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/payments`, ...args),
  /* Paid, or back to Unpaid. Set by hand at the counter, so correctable
     by hand — there is no receipt behind it to contradict. */
  markPayment: (paymentId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/payments/${paymentId}/mark`, ...args),
  cancelPayment: (paymentId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/payments/${paymentId}/cancel`, ...args),
  /* The Punong Barangay settles at the table: writes the minutes, closes
     the case, and stands down every sitting still on the calendar. */
  settleAtHearing: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/settle`, ...args),
  /* Summons, and the weeks of hearings it opens. */
  issueSummons: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/summons`, ...args),
  toConciliation: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/to-conciliation`, ...args),
  cases: (...args: QueryArgs) =>
    api.get("/lupon/cases", ...args),
  fileComplaint: (...args: BodyArgs) =>
    api.post("/lupon/cases", ...args),
  caseFile: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/lupon/cases/${caseId}`, ...args),
  kpForms: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/lupon/cases/${caseId}/forms`, ...args),
  scheduleHearing: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/hearings`, ...args),
  recordMediation: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/mediation`, ...args),
  recordConciliation: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/conciliation`, ...args),
  registerSettlement: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/settlement`, ...args),
  caseSettlementAction: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/settlement-action`, ...args),
  deadlines: (...args: QueryArgs) =>
    api.get("/lupon/deadlines", ...args),
  hearings: (...args: QueryArgs) =>
    api.get("/lupon/hearings", ...args),
  recordHearingOutcome: (hearingId: PathParam, ...args: BodyArgs) =>
    api.put(`/lupon/hearings/${hearingId}`, ...args),
  rescheduleHearing: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/reschedule`, ...args),
  recordSummons: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/summons`, ...args),
  monthlyTransmittal: (...args: QueryArgs) =>
    api.get("/lupon/reports/monthly-transmittal", ...args),
  settlements: (...args: QueryArgs) =>
    api.get("/lupon/settlements", ...args),
  settlementAction: (settlementId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/settlements/${settlementId}/action`, ...args),
};
