import { useState, useEffect, type FormEvent } from "react";
import { useNeedsConnection } from "../../../shared/offline/NeedsConnection";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { personName } from "../../../shared/lib/names";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import type { Resident } from "../../../shared/types";
import {
  localNow, relationshipChoice, relationshipValue,
} from "../lib/caseOptions";
import { bpoPayload, emptyBpo, type BpoDraft } from "../components/BpoFields";
import { vawcApi } from "../api";
import type { VawcCase } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

/** Whoever reported it, when that was not the victim-survivor herself. */
export const reportedBySomeoneElse = (type: string | null | undefined) =>
  Boolean(type) && type !== "Victim-Survivor";

/**
 * The state and handlers of <CaseList>, so its sections can share them.
 */
export function useCaseRegistry(options?: { status?: "Active" | "Closed" }) {
  const statusFilter = options?.status ?? "Active";
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
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [survivor, setSurvivor] = useState<Resident | null>(null);
  /*
   * Empty, not the first type: a type sitting pre-chosen gets submitted by
   * whoever does not read that line, and "Physical" was recorded that way.
   */
  /* One case is often several kinds; the acts under them are optional. */
  const [violenceKinds, setViolenceKinds] = useState<string[]>([]);
  const [violenceActs, setViolenceActs] = useState<string[]>([]);
  /* The relationship select, and the words typed under "Other (Specify)". */
  const [relationship, setRelationship] = useState("");
  const [relationshipOther, setRelationshipOther] = useState("");
  // Dependents are picked from the registry; the count follows the picks.
  const [dependents, setDependents] = useState<Resident[]>([]);

  /*
   * Who reported the case — a dropdown, not a checkbox.
   *
   * Empty until answered: the desk must say it, because "the victim-survivor
   * herself" and "her mother" lead to different questions below.
   */
  const [reportedByType, setReportedByType] = useState("");
  const reportedByOther = reportedBySomeoneElse(reportedByType);
  const [reportedByName, setReportedByName] = useState("");
  /*
   * The reporter as a register record, when they are one.
   *
   * Held alongside the name rather than instead of it: whichever way the
   * clerk answered, the case keeps a readable name.
   */
  const [reportedByResident, setReportedByResident] = useState<Resident | null>(null);
  const [reporterOffRegister, setReporterOffRegister] = useState(false);
  const [reportedByRelationship, setReportedByRelationship] = useState("");
  const [reportedByContact, setReportedByContact] = useState("");

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

  /*
   * The number comes from the register, not from the clerk — only when a
   * picked person actually has one on file.
   */
  const fromRecord = Boolean(
    reportedByOther && !reporterOffRegister && reportedByResident?.contact_number,
  );

  // Recorded, not assumed: an intake encoded the next morning must carry the
  // hour the complaint was actually made.
  const [reportedAt, setReportedAt] = useState(localNow);
  const [notes, setNotes] = useState("");

  /* The incident: when, about what time, where, and what happened. */
  const [occurredAt, setOccurredAt] = useState("");
  const [approximateTime, setApproximateTime] = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [narrative, setNarrative] = useState("");

  /*
   * The respondent — the person reported to have committed the act.
   *
   * A register id, and always a resident of this barangay: a protection
   * order is issued against somebody the Punong Barangay has power over.
   */
  const [respondent, setRespondent] = useState<Resident | null>(null);
  /* Item 9: on what authority somebody files for another person. */
  const [applicantConsent, setApplicantConsent] = useState("");

  /* The immediate safety assessment — unanswered until the desk answers. */
  const [currentlyInDanger, setCurrentlyInDanger] = useState<"Yes" | "No" | "Unknown" | null>(null);
  const [protectionNeeded, setProtectionNeeded] = useState<"Yes" | "No" | null>(null);
  const [bpo, setBpo] = useState<BpoDraft>(emptyBpo);

  // Correcting an intake: the API already allowed it, the registry did not.
  const [editing, setEditing] = useState<VawcCase | null>(null);
  const [editSurvivor, setEditSurvivor] = useState<Resident | null>(null);
  const [editDependents, setEditDependents] = useState<Resident[]>([]);

  const [editForm, setEditForm] = useState({
    /* The edit form works the same list. A case filed before it existed
       is loaded with the one kind it already had. */
    violence_types: [] as string[],
    violence_acts: [] as string[],
    reported_by_type: "Victim-Survivor",
    relationship_choice: "",
    relationship_other: "",
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
  const editReportedByOther = reportedBySomeoneElse(editForm.reported_by_type);
  /* The case's intake as the edit form opened on it. */
  const [editOriginal, setEditOriginal] = useState<{ form: typeof editForm; survivor: Resident | null; dependents: Resident[] } | null>(null);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    vawcApi.cases({ params: { page, status: statusFilter, ...periodParams(period) } })
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
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(noteOffline)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, period, statusFilter]);

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

  /** Clears the intake form's boxes. */
  const resetIntake = () => {
    setReportedByResident(null);
    setReporterOffRegister(false);
    setSurvivor(null);
    setViolenceKinds([]);
    setViolenceActs([]);
    setRelationship("");
    setRelationshipOther("");
    setDependents([]);
    setReportedByType("");
    setReportedByName("");
    setReportedByRelationship("");
    setReportedByContact("");
    /*
     * The incident boxes clear too. An intake form that opens holding the
     * last applicant's answers is how one person's incident ends up on
     * another person's case.
     */
    setOccurredAt("");
    setApproximateTime("");
    setIncidentLocation("");
    setNarrative("");
    /* The respondent clears with everything else. Somebody left behind here
       would be accused on the next case filed. */
    setRespondent(null);
    setApplicantConsent("");
    setCurrentlyInDanger(null);
    setProtectionNeeded(null);
    setBpo(emptyBpo());
    setReportedAt(localNow());
    setNotes("");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    resetIntake();
  };

  /*
   * THE CONFIDENTIAL INTAKE'S DRAFT LIVES IN THIS TAB'S MEMORY ONLY.
   *
   * A survivor's account is never written to the device — not to storage,
   * not to the offline queue. But losing it to a stray click outside the
   * dialog means asking them to tell it again, so it is kept in memory: it
   * survives the dialog closing and a move to another page, and is gone on
   * a refresh, a closed tab, Discard, or logout.
   */
  const intakeValue = {
    survivor, violenceKinds, violenceActs, relationship, relationshipOther, dependents, reportedByType,
    reportedByName, reportedByResident, reporterOffRegister, reportedByRelationship, reportedByContact,
    reportedAt, notes, occurredAt, approximateTime, incidentLocation, narrative, respondent,
    applicantConsent, currentlyInDanger, protectionNeeded, bpo,
  };
  const intakeDraft = useModalDraft<typeof intakeValue>(
    "vawc-intake",
    intakeOpen,
    intakeValue,
    (kept) => {
      setSurvivor(kept.survivor ?? null);
      setViolenceKinds(kept.violenceKinds ?? []);
      setViolenceActs(kept.violenceActs ?? []);
      setRelationship(kept.relationship ?? "");
      setRelationshipOther(kept.relationshipOther ?? "");
      setDependents(kept.dependents ?? []);
      setReportedByType(kept.reportedByType ?? "");
      setReportedByName(kept.reportedByName ?? "");
      setReportedByResident(kept.reportedByResident ?? null);
      setReporterOffRegister(Boolean(kept.reporterOffRegister));
      setReportedByRelationship(kept.reportedByRelationship ?? "");
      setReportedByContact(kept.reportedByContact ?? "");
      if (kept.reportedAt) setReportedAt(kept.reportedAt);
      setNotes(kept.notes ?? "");
      setOccurredAt(kept.occurredAt ?? "");
      setApproximateTime(kept.approximateTime ?? "");
      setIncidentLocation(kept.incidentLocation ?? "");
      setNarrative(kept.narrative ?? "");
      setRespondent(kept.respondent ?? null);
      setApplicantConsent(kept.applicantConsent ?? "");
      setCurrentlyInDanger(kept.currentlyInDanger ?? null);
      setProtectionNeeded(kept.protectionNeeded ?? null);
      setBpo(kept.bpo ?? emptyBpo());
    },
    {
      memoryOnly: true,
      /* Nothing answered yet — the report time fills itself in. */
      isEmpty: (v) => !v.survivor && !v.respondent && !v.reportedByResident && !v.reporterOffRegister
        && v.violenceKinds.length === 0 && v.violenceActs.length === 0 && v.dependents.length === 0
        && !v.relationship && !v.relationshipOther && !v.reportedByType && !v.reportedByName
        && !v.reportedByRelationship && !v.reportedByContact && !v.notes && !v.occurredAt
        && !v.approximateTime && !v.incidentLocation && !v.narrative && !v.applicantConsent
        && v.currentlyInDanger === null && v.protectionNeeded === null
        && JSON.stringify(v.bpo) === JSON.stringify(emptyBpo()),
      reset: resetIntake,
    },
  );

  /**
   * What is still unanswered, in the form's own words.
   *
   * The pickers and the Yes/No buttons are not form controls a browser can
   * mark `required`, so they are checked here — before the confirmation,
   * not after a round trip that names a field the clerk cannot see.
   */
  const missingFromIntake = (): string[] => [
    !survivor && "the Victim-Survivor",
    !reportedByType && "who reported the case",
    !respondent && "the Respondent",
    violenceKinds.length === 0 && "the kind of reported violence",
    !narrative.trim() && "a brief description of the reported incident",
    !currentlyInDanger && "whether the victim-survivor is currently in danger",
    !protectionNeeded && "whether immediate protection is needed",
  ].filter((item): item is string => Boolean(item));

  const intake = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const missing = missingFromIntake();
    if (missing.length > 0) {
      toast(`Still needed: ${missing.join(", ")}.`, "error");
      return;
    }

    if (!(await confirmAction({ title: "File this confidential case?", confirmText: "Yes, file case" }))) return;
    try {
      await vawcApi.openCase({
        survivor_id: survivor?.id,
        reported_by_type: reportedByType,
        violence_types: violenceKinds,
        violence_acts: violenceActs,
        relationship_to_offender: relationshipValue(relationship, relationshipOther) ?? undefined,
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
         * The date only; the time, when known, goes in words beside it.
         * Midnight is appended so the column stays a datetime.
         */
        occurred_at: occurredAt ? occurredAt + " 00:00:00" : undefined,
        approximate_time: approximateTime.trim() || undefined,
        incident_location: incidentLocation || undefined,
        incident_narrative: narrative.trim(),
        currently_in_danger: currentlyInDanger,
        protection_needed: protectionNeeded,
        protection_order: protectionNeeded === "Yes" ? bpoPayload(bpo) : undefined,
        /*
         * Every case this desk files is taken at the counter, so the channel
         * is stated here rather than asked.
         */
        reporting_channel: "Walk-in",
        report_date: reportedAt ? reportedAt.replace("T", " ") + ":00" : undefined,
        confidential_notes: notes || undefined,
      });
      intakeDraft.clear();
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
    const rel = relationshipChoice(c.relationship_to_offender);
    const form: typeof editForm = {
      violence_types: c.violence_types?.length ? c.violence_types : (c.violence_type ? [c.violence_type] : []),
      violence_acts: c.violence_acts ?? [],
      reported_by_type: c.reported_by_type ?? (c.reported_by_name ? "Other" : "Victim-Survivor"),
      relationship_choice: rel.choice,
      relationship_other: rel.other,
      children_involved: c.children_involved,
      children_count: String(c.children_count ?? 0),
      children_details: c.children_details ?? "",
      immediate_needs: c.immediate_needs ?? "",
      previous_incidents_count: String(c.previous_incidents_count ?? 0),
      confidential_notes: c.confidential_notes ?? "",
      reported_by_name: c.reported_by_name ?? "",
      reported_by_relationship: c.reported_by_relationship ?? "",
      reported_by_contact: c.reported_by_contact ?? "",
    };
    setEditing(c);
    setEditSurvivor(c.survivor ?? null);
    setEditDependents(c.dependents ?? []);
    setEditForm(form);
    setEditOriginal({ form, survivor: c.survivor ?? null, dependents: c.dependents ?? [] });
  };

  /* A correction being typed: tab memory only, like the intake. Its version
     is the case as it was opened, so old typing never lands on a newer save. */
  const editDraft = useModalDraft(
    editing && editOriginal ? `edit-vawc-case:${editing.id}` : null,
    editing !== null && editOriginal !== null,
    { form: editForm, survivor: editSurvivor, dependents: editDependents },
    (kept) => {
      if (!editOriginal) return;
      setEditForm({ ...editOriginal.form, ...kept.form });
      setEditSurvivor(kept.survivor ?? editOriginal.survivor);
      setEditDependents(kept.dependents ?? editOriginal.dependents);
    },
    {
      memoryOnly: true,
      blank: editOriginal ?? undefined,
      reset: () => {
        if (!editOriginal) return;
        setEditForm(editOriginal.form);
        setEditSurvivor(editOriginal.survivor);
        setEditDependents(editOriginal.dependents);
      },
      version: editOriginal
        ? JSON.stringify({ form: editOriginal.form, survivor: editOriginal.survivor?.id ?? null,
          dependents: editOriginal.dependents.map((d) => d.id) })
        : null,
    },
  );

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (!(await confirmAction({ title: "Save changes to this case?", confirmText: "Yes, save" }))) return;
    try {
      const { relationship_choice, relationship_other, ...fields } = editForm;
      await vawcApi.updateCase(editing.id, {
        ...fields,
        survivor_id: editSurvivor?.id,
        dependent_ids: editDependents.map((d) => d.id),
        previous_incidents_count: Number(editForm.previous_incidents_count) || 0,
        reported_by_name: editReportedByOther ? editForm.reported_by_name || null : null,
        reported_by_relationship: editReportedByOther ? editForm.reported_by_relationship || null : null,
        reported_by_contact: editReportedByOther ? editForm.reported_by_contact || null : null,
        relationship_to_offender: relationshipValue(relationship_choice, relationship_other),
        immediate_needs: editForm.immediate_needs || null,
        confidential_notes: editForm.confidential_notes || null,
      });
      editDraft.clear();
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
    pageLoad,
    offline,
    rows, setRows, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, intakeOpen, setIntakeOpen, survivor, setSurvivor,
    violenceKinds, setViolenceKinds, violenceActs, setViolenceActs,
    relationship, setRelationship, dependents, setDependents,
    reportedByType, setReportedByType, reportedByOther,
    reportedByName, setReportedByName, reportedByResident,
    setReportedByResident, pickReporter, reporterOffRegister, setReporterOffRegister,
    fromRecord, reportedByRelationship, setReportedByRelationship, reportedByContact,
    setReportedByContact, reportedAt, setReportedAt,
    notes, setNotes, editing, setEditing, editSurvivor,
    setEditSurvivor, editReportedByOther, editDependents,
    setEditDependents, occurredAt, setOccurredAt, approximateTime, setApproximateTime,
    incidentLocation, setIncidentLocation, narrative, setNarrative,
    relationshipOther, setRelationshipOther,
    respondent, setRespondent,
    applicantConsent, setApplicantConsent,
    currentlyInDanger, setCurrentlyInDanger, protectionNeeded, setProtectionNeeded, bpo, setBpo,
    editForm, setEditForm, load, changePeriod, resetIntake,
    closeIntake, intake, openEdit, saveEdit, setEdit, intakeDraft, editDraft,
    status: statusFilter,
  };
}

export type CaseRegistryState = ReturnType<typeof useCaseRegistry>;
