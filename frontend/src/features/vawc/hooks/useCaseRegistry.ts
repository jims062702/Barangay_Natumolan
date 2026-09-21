import { useState, useEffect, type FormEvent } from "react";
import { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { personName } from "../../../shared/lib/names";
import { toast } from "../../../shared/lib/toast";
import type { Resident } from "../../../shared/types";
import { localNow, VIOLENCE_TYPES } from "../lib/caseOptions";
import { vawcApi } from "../api";
import type { VawcCase } from "../types";

/**
 * The state and handlers of <CaseList>, so its sections can share them.
 */
export function useCaseRegistry() {
  /* Never held on this device — the page says so rather than reading empty. */
  const { offline, noteOffline } = useNeedsConnection();
  const [rows, setRows] = useState<VawcCase[]>([]);

  /* Which stretch of time the docket is showing. */
  const [period, setPeriod] = useState<Period>(ALL_TIME);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  /* How many records each period holds, for the picker itself. */
  const [periodCounts, setPeriodCounts] = useState<Record<string, number>>();
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [survivor, setSurvivor] = useState<Resident | null>(null);
  /*
   * Empty, not the first type.
   *
   * The dropdown was given a "Select type…" placeholder but the state still
   * started on VIOLENCE_TYPES[0] — so the box read "Physical" from the
   * moment it opened, and a form submitted without anybody reading that line
   * recorded physical violence. Changing what the list OFFERS without
   * changing what it HOLDS fixed nothing.
   */
  const [violenceType, setViolenceType] = useState("");
  const [relationship, setRelationship] = useState("");
  // Dependents are picked from the registry; the count follows the picks.
  const [dependents, setDependents] = useState<Resident[]>([]);
  // Off by default: most complaints come from the survivor herself, and the
  // reporting-party fields stay locked until the officer says otherwise.
  const [reportedByOther, setReportedByOther] = useState(false);
  const [reportedByName, setReportedByName] = useState("");
  /*
   * The reporter as a register record, when they are one.
   *
   * Held alongside the name rather than instead of it: whichever way the
   * clerk answered, the case keeps a readable name.
   */
  const [reportedByResident, setReportedByResident] = useState<Resident | null>(null);

  /*
   * Attach the reporter and take their number with them.
   *
   * Cleared as well as set: picking Ana after Ben must not leave Ben's
   * number sitting in the box under Ana's name.
   */
  const pickReporter = (person: Resident | null) => {
    setReportedByResident(person);
    setReportedByContact(person?.contact_number ?? "");
  };
  const [reporterOffRegister, setReporterOffRegister] = useState(false);

  /*
   * The number comes from the register, not from the clerk.
   *
   * True only when a picked person actually has one on file — which is the
   * minority — so everything downstream reads this rather than re-deriving
   * the same three conditions and getting one of them wrong.
   */
  const fromRecord = Boolean(
    reportedByOther && !reporterOffRegister && reportedByResident?.contact_number,
  );
  const [reportedByRelationship, setReportedByRelationship] = useState("");
  const [reportedByContact, setReportedByContact] = useState("");
  // Recorded, not assumed: an intake encoded the next morning must carry the
  // hour the complaint was actually made.
  const [reportedAt, setReportedAt] = useState(localNow);
  const [notes, setNotes] = useState("");

  // Correcting an intake: the API already allowed it, the registry did not.
  const [editing, setEditing] = useState<VawcCase | null>(null);
  const [editSurvivor, setEditSurvivor] = useState<Resident | null>(null);
  const [editReportedByOther, setEditReportedByOther] = useState(false);
  const [editDependents, setEditDependents] = useState<Resident[]>([]);
  /* The incident itself: when and where. */
  const [occurredAt, setOccurredAt] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");

  /*
   * The respondent — item 4 of the protection-order application.
   *
   * ONE SHAPE, not two: a register id. A barangay protection order is issued
   * against a resident of this barangay, because that is the only person the
   * Punong Barangay has power over. A typed name for somebody from elsewhere
   * was offered here briefly and was simply wrong — it produced a case whose
   * order nobody could serve.
   *
   * Everything item 4 asks for is on their resident record, and the order is
   * drawn from the record so it reaches where they live now.
   */
  const [respondent, setRespondent] = useState<Resident | null>(null);
  /* Item 9: on what authority somebody files for another person. */
  const [applicantConsent, setApplicantConsent] = useState("");
  /* "Other" opens a box: the list cannot anticipate every household. */
  const [relationshipOther, setRelationshipOther] = useState("");

  /*
   * THE INTAKE FORM ASKS LESS THAN IT DID.
   *
   * Gone from it: how the complaint reached us (every case here is a
   * walk-in), whether the incident is ongoing, whether the offender is
   * nearby, the risk level, the count of previous incidents, immediate
   * needs, and the incident narrative.
   *
   * The COLUMNS all remain, and so do the case detail and edit screens that
   * read and write them — cases already on the register keep everything
   * they were taken down with, and an officer can still set a risk level on
   * a case once it is open. What changed is what a clerk is asked at the
   * counter while somebody is standing there.
   */

  const [editForm, setEditForm] = useState({
    violence_type: VIOLENCE_TYPES[0],
    relationship_to_offender: "",
    children_involved: false,
    children_count: "0",
    children_details: "",
    immediate_needs: "",
    previous_incidents_count: "0",
    confidential_notes: "",
    reported_by_name: "",
    reported_by_relationship: "",
    reported_by_contact: "",
  });

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    vawcApi.cases({ params: { page, ...periodParams(period) } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        /* The window the server actually resolved, which is not always the
           one the buttons imply — a month with no year means this year. */
        setWindowLabel(r.data.data.window?.label ?? null);
        setYears(r.data.data.years ?? []);
        setPeriodCounts(r.data.data.period_counts);
      })
      .catch(noteOffline)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, period]);

  /* A narrower window almost never has as many pages, and page 4 of a
     one-page result is an empty docket that looks like no cases at all. */
  const changePeriod = (next: Period) => {
    setPeriod(next);
    setPage(1);
  };

  // Live updates without a manual refresh.
  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("vawc_cases", () => load(true));

  /** Clears the confidential intake draft — nothing may survive a cancel. */
  const resetIntake = () => {
    setReportedByResident(null);
    setReporterOffRegister(false);
    setSurvivor(null);
    setViolenceType("");
    setRelationship("");
    setDependents([]);
    setReportedByOther(false);
    setReportedByName("");
    setReportedByRelationship("");
    setReportedByContact("");
    /*
     * The incident boxes clear too. An intake form that opens holding the
     * last applicant's answers is how one person's incident ends up on
     * another person's case.
     */
    setOccurredAt("");
    setIncidentLocation("");
    setRelationshipOther("");
    /* The respondent clears with everything else. Somebody left behind here
       would be accused on the next case filed. */
    setRespondent(null);
    setApplicantConsent("");
    setReportedAt(localNow());
    setNotes("");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    resetIntake();
  };

  const intake = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await confirmAction({ title: "File this confidential case?", confirmText: "Yes, file case" }))) return;
    try {
      await vawcApi.openCase({
        survivor_id: survivor?.id,
        violence_type: violenceType,
        relationship_to_offender:
          relationship === "Other"
            ? (relationshipOther.trim() || "Other")
            : (relationship || undefined),
        dependent_ids: dependents.map((d) => d.id),
        reported_by_name: reportedByOther
          ? (reporterOffRegister
              ? reportedByName || undefined
              /* The picked person's name travels too, so the case still reads
                 correctly if that register record is ever removed. */
              : (reportedByResident ? personName(reportedByResident) : undefined))
          : undefined,
        reported_by_resident_id:
          reportedByOther && !reporterOffRegister ? reportedByResident?.id : undefined,
        reported_by_relationship: reportedByOther ? reportedByRelationship || undefined : undefined,
        reported_by_contact: reportedByOther ? reportedByContact || undefined : undefined,
        /* Only asked, and only sent, when somebody files for another person. */
        applicant_consent: reportedByOther ? applicantConsent.trim() || undefined : undefined,
        /* An id, and only an id. The register holds the rest. */
        respondent_id: respondent?.id,
        /*
         * A date, no clock. A survivor recalling last Tuesday does not
         * recall 14:35, and a box asking for one invites a number nobody
         * stands behind. Midnight is appended so the column stays a datetime.
         */
        occurred_at: occurredAt ? occurredAt + " 00:00:00" : undefined,
        incident_location: incidentLocation || undefined,
        /*
         * Every case this desk files is taken at the counter, so the channel
         * is stated here rather than asked. It was a dropdown with one true
         * answer and six wrong ones.
         */
        reporting_channel: "Walk-in",
        report_date: reportedAt ? reportedAt.replace("T", " ") + ":00" : undefined,
        confidential_notes: notes || undefined,
      });
      setIntakeOpen(false);
      resetIntake();
      toast("Case recorded confidentially. A case code was assigned in place of the survivor's name.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /**
   * Fetches the full case rather than reusing the list row: the registry
   * deliberately carries case codes only, and opening identifiable detail is
   * exactly the event the access trail exists to record.
   */
  const openEdit = async (row: VawcCase) => {
    let c = row;
    try {
      const response = await vawcApi.caseFile(row.id);
      c = response.data.data;
    } catch {
      // Fall back to the list row — the form still works, minus the survivor.
    }
    setEditing(c);
    setEditSurvivor(c.survivor ?? null);
    setEditReportedByOther(Boolean(c.reported_by_name));
    setEditDependents(c.dependents ?? []);
    setEditForm({
      violence_type: c.violence_type,
      relationship_to_offender: c.relationship_to_offender ?? "",
      children_involved: c.children_involved,
      children_count: String(c.children_count ?? 0),
      children_details: c.children_details ?? "",
      immediate_needs: c.immediate_needs ?? "",
      previous_incidents_count: String(c.previous_incidents_count ?? 0),
      confidential_notes: c.confidential_notes ?? "",
      reported_by_name: c.reported_by_name ?? "",
      reported_by_relationship: c.reported_by_relationship ?? "",
      reported_by_contact: c.reported_by_contact ?? "",
    });
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (!(await confirmAction({ title: "Save changes to this case?", confirmText: "Yes, save" }))) return;
    try {
      await vawcApi.updateCase(editing.id, {
        ...editForm,
        survivor_id: editSurvivor?.id,
        dependent_ids: editDependents.map((d) => d.id),
        previous_incidents_count: Number(editForm.previous_incidents_count) || 0,
        reported_by_name: editReportedByOther ? editForm.reported_by_name || null : null,
        reported_by_relationship: editReportedByOther ? editForm.reported_by_relationship || null : null,
        reported_by_contact: editReportedByOther ? editForm.reported_by_contact || null : null,
        relationship_to_offender: editForm.relationship_to_offender || null,
        immediate_needs: editForm.immediate_needs || null,
        confidential_notes: editForm.confidential_notes || null,
      });
      setEditing(null);
      toast(`${editing.case_code} updated — the change is in the access trail.`);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const setEdit = <K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) =>
    setEditForm((prev) => ({ ...prev, [key]: value }));

  return {
    offline,
    rows, setRows, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, intakeOpen, setIntakeOpen, survivor, setSurvivor, violenceType,
    setViolenceType, relationship, setRelationship, dependents, setDependents, reportedByOther,
    setReportedByOther, reportedByName, setReportedByName, reportedByResident,
    setReportedByResident, pickReporter, reporterOffRegister, setReporterOffRegister,
    fromRecord, reportedByRelationship, setReportedByRelationship, reportedByContact,
    setReportedByContact, reportedAt, setReportedAt,
    notes, setNotes, editing, setEditing, editSurvivor,
    setEditSurvivor, editReportedByOther, setEditReportedByOther, editDependents,
    setEditDependents, occurredAt, setOccurredAt, incidentLocation, setIncidentLocation,
    relationshipOther, setRelationshipOther,
    respondent, setRespondent,
    applicantConsent, setApplicantConsent,
    editForm, setEditForm, load, changePeriod, resetIntake,
    closeIntake, intake, openEdit, saveEdit, setEdit,
  };
}

export type CaseRegistryState = ReturnType<typeof useCaseRegistry>;
