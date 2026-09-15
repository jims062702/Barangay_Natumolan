import { useState, useEffect, type FormEvent } from "react";
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
  const [previousIncidents, setPreviousIncidents] = useState("0");
  const [narrative, setNarrative] = useState("");
  const [notes, setNotes] = useState("");

  // Correcting an intake: the API already allowed it, the registry did not.
  const [editing, setEditing] = useState<VawcCase | null>(null);
  const [editSurvivor, setEditSurvivor] = useState<Resident | null>(null);
  const [editReportedByOther, setEditReportedByOther] = useState(false);
  const [editDependents, setEditDependents] = useState<Resident[]>([]);
  /*
   * The incident itself: when, where, and whether it is still happening.
   *
   * Everything else on this form is history. These are the only questions
   * that say whether she is safe tonight.
   */
  const [occurredAt, setOccurredAt] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  /*
   * Three answers, and "unanswered" is a fourth state.
   *
   * These were boolean|null, with null doing double duty as "Not known" AND
   * as "nobody has said" — so the form opened with "Not known" already
   * ticked, and an officer who never reached the question left an answer on
   * the record they had not given. Now null means only the second thing, and
   * nothing is ticked until somebody chooses.
   */
  const [isOngoing, setIsOngoing] = useState<string | null>(null);
  const [offenderNearby, setOffenderNearby] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState("");
  /* "Other" opens a box: the list cannot anticipate every household. */
  const [relationshipOther, setRelationshipOther] = useState("");
  const [channel, setChannel] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [needsOther, setNeedsOther] = useState("");

  /**
   * A yes/no/not-known answer, as the column holds it.
   *
   * "Not known" is null, not false. Sending false would record "he is NOT
   * near her" when what the officer said was that she could not tell — and
   * on a risk assessment that is the difference between sending somebody
   * tonight and not.
   *
   * An unanswered question sends nothing at all, so the field is left as it
   * was rather than overwritten with a guess.
   */
  const yesNo = (answer: string | null): boolean | null | undefined => {
    if (answer === null) return undefined;

    return answer === "unknown" ? null : answer === "yes";
  };

  const toggleNeed = (need: string) =>
    setNeeds((prev) => (prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]));

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
     * The new boxes clear too. An intake form that opens holding the last
     * survivor's answers is how one person's incident ends up on another
     * person's case.
     */
    setNeeds([]);
    setNeedsOther("");
    setOccurredAt("");
    setIncidentLocation("");
    setIsOngoing(null);
    setOffenderNearby(null);
    setRelationshipOther("");
    setRiskLevel("");
    setChannel("");
    setPreviousIncidents("0");
    setReportedAt(localNow());
    setNarrative("");
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
        immediate_needs: needs.length ? needs : undefined,
        immediate_needs_other: needsOther || undefined,
        /*
         * A date, no clock. A survivor recalling last Tuesday does not
         * recall 14:35, and a box asking for one invites a number nobody
         * stands behind. Midnight is appended so the column stays a datetime.
         */
        occurred_at: occurredAt ? occurredAt + " 00:00:00" : undefined,
        incident_location: incidentLocation || undefined,
        /*
         * "Not known" is an answer and is sent as such — as null, which is
         * what the column holds. Leaving the question unanswered sends
         * nothing at all.
         */
        is_ongoing: yesNo(isOngoing),
        offender_nearby: yesNo(offenderNearby),
        risk_level: riskLevel || undefined,
        reporting_channel: channel || undefined,
        previous_incidents_count: Number(previousIncidents) || 0,
        report_date: reportedAt ? reportedAt.replace("T", " ") + ":00" : undefined,
        incident_narrative: narrative || undefined,
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
    rows, setRows, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, intakeOpen, setIntakeOpen, survivor, setSurvivor, violenceType,
    setViolenceType, relationship, setRelationship, dependents, setDependents, reportedByOther,
    setReportedByOther, reportedByName, setReportedByName, reportedByResident,
    setReportedByResident, pickReporter, reporterOffRegister, setReporterOffRegister,
    fromRecord, reportedByRelationship, setReportedByRelationship, reportedByContact,
    setReportedByContact, reportedAt, setReportedAt, previousIncidents, setPreviousIncidents,
    narrative, setNarrative, notes, setNotes, editing, setEditing, editSurvivor,
    setEditSurvivor, editReportedByOther, setEditReportedByOther, editDependents,
    setEditDependents, occurredAt, setOccurredAt, incidentLocation, setIncidentLocation,
    isOngoing, setIsOngoing, offenderNearby, setOffenderNearby, riskLevel, setRiskLevel,
    relationshipOther, setRelationshipOther, channel, setChannel, needs, setNeeds, needsOther,
    setNeedsOther, yesNo, toggleNeed, editForm, setEditForm, load, changePeriod, resetIntake,
    closeIntake, intake, openEdit, saveEdit, setEdit,
  };
}

export type CaseRegistryState = ReturnType<typeof useCaseRegistry>;
