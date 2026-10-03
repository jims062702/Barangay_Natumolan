/** The Lupon Tagapamayapa docket: cases, hearings, settlements, reports. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const luponApi = {
  /* A case with no respondent yet (accepted online before it was required). */
  nameRespondents: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/respondents`, ...args),
  /* The filing fee: Paid on sight of the official receipt, pressed by the
     Lupon — and undone for a mis-click until the summons goes out. */
  markFeePaid: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/filing-fee/paid`, ...args),
  undoFeePaid: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/filing-fee/undo`, ...args),
  /* The Punong Barangay settles at the table: writes the minutes, closes
     the case, and stands down every sitting still on the calendar. */
  settleAtHearing: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/settle`, ...args),
  /* No toConciliation: a case leaves the Punong Barangay when the third
     Tuesday is spent without agreement, not when somebody decides it has
     been long enough. `issueSummons` below is what books either set of
     sittings. */
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
  /* One sitting, with the complaint behind it — for the minutes screen. */
  hearing: (hearingId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/lupon/hearings/${hearingId}`, ...args),
  recordHearingOutcome: (hearingId: PathParam, ...args: BodyArgs) =>
    api.put(`/lupon/hearings/${hearingId}`, ...args),
  recordSummons: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/summons`, ...args),
  /* The Secretary printed the summons: the parties are told the schedule
     and the case reaches their Lupon Records. */
  summonsPrinted: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/summons-printed`, ...args),
  /* The HOUR of a sitting, moved by the desk that works it. The day does
     not move: the summons in a party's hand names it. */
  setStartTime: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/start-time`, ...args),
  /* The sitting was held: the minutes, and which of the three endings. */
  recordSession: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/session`, ...args),
  /* No cancelHearing and no rescheduleHearing. A sitting the parties were
     summoned to is not moved or called off: the barangay sits on fixed
     days, and the summons in their hands names the day. */
  /* The complainant takes the complaint back, and the case closes. */
  withdrawCase: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/withdraw`, ...args),
  /* Certified to file action: the complainant may go to court. */
  certifyToFileAction: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/cfa`, ...args),
  /* The case as the hearing room reads it: the complaint, the parties and
     the sittings, and nothing that could change them. The Secretary writes
     the minutes and has no docket to open. */
  hearingCase: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/lupon/hearing-cases/${caseId}`, ...args),
  /* A month of the Punong Barangay's sittings, for the calendar. Read
     only, and not paginated — a month is the page. */
  hearingCalendar: (...args: QueryArgs) =>
    api.get("/lupon/hearing-calendar", ...args),
  /* What has been forwarded to this desk and has no sitting yet: the fee is
     paid and the Secretary must print, or the Tuesdays are spent and the
     Lupon must. */
  awaitingSummons: (...args: QueryArgs) =>
    api.get("/lupon/awaiting-summons", ...args),
  /* Printing is what books the sittings — three Tuesdays, or three
     Thursdays, depending on whose desk the case is on. */
  /* The sittings the papers would book — printed from BEFORE anything is booked. */
  summonsPlan: (caseId: PathParam | undefined, ...args: QueryArgs) =>
    api.get(`/lupon/cases/${caseId}/summons-plan`, ...args),
  issueSummons: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/summons`, ...args),
  generateSummon: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/generate-summon`, ...args),
  scheduleNextHearing: (caseId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/cases/${caseId}/schedule-next`, ...args),
  saveMinutes: (hearingId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/hearings/${hearingId}/minutes`, ...args),
  /* The hearing room's other two lists: withdrawn cases, and CFA cases. */
  hearingCases: (...args: QueryArgs) =>
    api.get("/lupon/hearing-cases", ...args),
  casesFiled: (...args: QueryArgs) =>
    api.get("/lupon/reports/cases-filed", ...args),
  monthlyTransmittal: (...args: QueryArgs) =>
    api.get("/lupon/reports/monthly-transmittal", ...args),
  /* Complaints begun online. Everything up to `acceptOnlineComplaint` is a
     queue: the office reads the complaint and the ID before the person
     arrives. Accept is pressed at the counter, with them in front of it. */
  onlineComplaints: (...args: QueryArgs) =>
    api.get("/lupon/online-complaints", ...args),
  acceptOnlineComplaint: (complaintId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/online-complaints/${complaintId}/accept`, ...args),
  rejectOnlineComplaint: (complaintId: PathParam | undefined, ...args: BodyArgs) =>
    api.post(`/lupon/online-complaints/${complaintId}/reject`, ...args),
  settlements: (...args: QueryArgs) =>
    api.get("/lupon/settlements", ...args),
  settlementAction: (settlementId: PathParam, ...args: BodyArgs) =>
    api.post(`/lupon/settlements/${settlementId}/action`, ...args),
};
