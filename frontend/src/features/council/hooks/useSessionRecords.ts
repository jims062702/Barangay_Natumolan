import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { blankAttendee, asTime } from "../lib/sessions";
import { councilApi } from "../api";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import type { Session, Attendee } from "../types";

interface SessionFields {
  sessionType: "Regular" | "Special";
  sessionDate: string;
  calledAt: string;
  adjournedAt: string;
  venue: string;
  agenda: string;
  minutes: string;
  status: "Draft" | "For Approval";
  attendees: Attendee[];
}

const newSession = (): SessionFields => ({
  sessionType: "Regular", sessionDate: "", calledAt: "", adjournedAt: "", venue: "Barangay Hall",
  agenda: "", minutes: "", status: "Draft", attendees: [blankAttendee()],
});
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The state and handlers of <Sessions>, so its sections can share them.
 */
export function useSessionRecords() {
  const { user } = useAuth();
  /* Adoption is the council's act. The secretary writes; the PB adopts. */
  const canAdopt = user?.role === "Punong Barangay" || user?.role === "Admin";

  const [rows, setRows] = useState<Session[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  const [period, setPeriod] = useState<Period>(ALL_TIME);
  const [windowLabel, setWindowLabel] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  /* How many records each period holds, for the picker itself. */
  const [periodCounts, setPeriodCounts] = useState<Record<string, number>>();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [sessionType, setSessionType] = useState<"Regular" | "Special">("Regular");
  const [sessionDate, setSessionDate] = useState("");
  const [calledAt, setCalledAt] = useState("");
  const [adjournedAt, setAdjournedAt] = useState("");
  const [venue, setVenue] = useState("Barangay Hall");
  const [agenda, setAgenda] = useState("");
  const [minutes, setMinutes] = useState("");
  const [status, setStatus] = useState<"Draft" | "For Approval">("Draft");
  const [attendees, setAttendees] = useState<Attendee[]>([blankAttendee()]);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    councilApi.sessions({ params: { page, ...periodParams(period) } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
        setWindowLabel(r.data.data.window?.label ?? null);
        setYears(r.data.data.years ?? []);
        setPeriodCounts(r.data.data.period_counts);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, period]);

  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("sessions", () => load(true));

  const changePeriod = (next: Period) => {
    setPeriod(next);
    setPage(1);
  };

  const fill = (f: SessionFields) => {
    setSessionType(f.sessionType);
    setSessionDate(f.sessionDate);
    setCalledAt(f.calledAt);
    setAdjournedAt(f.adjournedAt);
    setVenue(f.venue);
    setAgenda(f.agenda);
    setMinutes(f.minutes);
    setStatus(f.status);
    setAttendees(f.attendees?.length ? f.attendees : [blankAttendee()]);
  };
  /* The session as the form opened on it: blank for a new one. */
  const [original, setOriginal] = useState<SessionFields>(newSession);

  const startNew = () => {
    setEditing(null);
    setOriginal(newSession());
    fill(newSession());
    setError("");
    setOpen(true);
  };

  /*
   * The minutes being written, kept until saved or discarded — a new session
   * under one name, each session's edit under its own. An adopted session
   * cannot be changed, so nothing is kept for it. An edit's version is the
   * session as it was opened: newer minutes are never overwritten by old
   * typing.
   */
  const draft = useModalDraft<SessionFields>(
    editing ? (editing.status === "Adopted" ? null : `edit-session:${editing.id}`) : "new-session",
    open,
    { sessionType, sessionDate, calledAt, adjournedAt, venue, agenda, minutes, status, attendees },
    (kept) => fill({ ...original, ...kept }),
    { blank: original, reset: () => fill(original), version: editing ? JSON.stringify(original) : null },
  );

  const startEdit = async (row: Session) => {
    /* The list carries counts, not the attendance sheet — fetched here so
       opening a session to read it does not cost every other row a join. */
    const full = (await councilApi.session(row.id)).data.data as Session;

    const fields: SessionFields = {
      sessionType: full.session_type,
      sessionDate: full.session_date.slice(0, 10),
      calledAt: asTime(full.called_to_order_at),
      adjournedAt: asTime(full.adjourned_at),
      venue: full.venue ?? "Barangay Hall",
      agenda: full.agenda ?? "",
      minutes: full.minutes ?? "",
      status: full.status === "Adopted" ? "For Approval" : full.status,
      attendees: full.attendees?.length ? full.attendees : [blankAttendee()],
    };
    setEditing(full);
    setOriginal(fields);
    fill(fields);
    setError("");
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();

    const isEdit = Boolean(editing);
    const confirmed = await confirmAction({
      title: isEdit ? "Save the session minutes?" : "Record this barangay session?",
      text: isEdit
        ? "Are you sure you want to update the session record, minutes, and attendance?"
        : "Are you sure you want to record this Sangguniang Barangay session?",
      confirmText: isEdit ? "Yes, save minutes" : "Yes, record session",
    });

    if (!confirmed) return;

    setSaving(true);
    setError("");

    const payload = {
      session_type: sessionType,
      session_date: sessionDate,
      called_to_order_at: calledAt || null,
      adjourned_at: adjournedAt || null,
      venue: venue || "Barangay Hall",
      agenda: agenda || null,
      minutes: minutes || null,
      status,
      /* Blank rows are somebody who started typing and stopped, not an
         official who was absent. */
      attendees: attendees.filter((a) => a.name.trim() !== ""),
    };

    try {
      /* The secretary writes the minutes at the session itself, which is
         exactly where the hall's line tends to be down. */
      const waiting = { offline: { label: `${sessionType} session — ${sessionDate}` } };

      if (editing) await councilApi.updateSession(editing.id, payload, waiting);
      else await councilApi.createSession(payload, waiting);

      draft.clear();
      setOpen(false);
      toast(
        isEdit ? "Session minutes saved successfully." : "Barangay session recorded successfully.",
        "success"
      );
      load();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      const msg = res?.data?.message ?? "The session could not be saved.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const adopt = async (row: Session) => {
    const confirmed = await confirmAction({
      title: `Adopt minutes for ${row.session_number}?`,
      text: "Once adopted by the council, these minutes become an official record and can no longer be edited.",
      confirmText: "Yes, adopt minutes",
    });

    if (!confirmed) return;

    try {
      await councilApi.adoptSession(row.id);
      toast("Session minutes adopted successfully.", "success");
      load();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      const msg = res?.data?.message ?? "The minutes could not be adopted.";
      toast(msg, "error");
    }
  };

  const setAttendee = (i: number, patch: Partial<Attendee>) =>
    setAttendees((list) => list.map((a, n) => (n === i ? { ...a, ...patch } : a)));

  return {
    pageLoad,
    user, canAdopt, rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, open, setOpen, editing, setEditing, saving, setSaving,
    error, setError, sessionType, setSessionType, sessionDate, setSessionDate, calledAt,
    setCalledAt, adjournedAt, setAdjournedAt, venue, setVenue, agenda, setAgenda, minutes,
    setMinutes, status, setStatus, attendees, setAttendees, load, changePeriod, startNew,
    startEdit, save, adopt, setAttendee, draft,
  };
}

export type SessionRecordsState = ReturnType<typeof useSessionRecords>;
