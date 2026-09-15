import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../../shared/auth/AuthContext";
import { type Period, ALL_TIME, periodParams } from "../../../shared/ui/PeriodFilter";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { blankAttendee, asTime } from "../lib/sessions";
import { councilApi } from "../api";
import type { Session, Attendee } from "../types";

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

  const startNew = () => {
    setEditing(null);
    setSessionType("Regular");
    setSessionDate("");
    setCalledAt("");
    setAdjournedAt("");
    setVenue("Barangay Hall");
    setAgenda("");
    setMinutes("");
    setStatus("Draft");
    setAttendees([blankAttendee()]);
    setError("");
    setOpen(true);
  };

  const startEdit = async (row: Session) => {
    /* The list carries counts, not the attendance sheet — fetched here so
       opening a session to read it does not cost every other row a join. */
    const full = (await councilApi.session(row.id)).data.data as Session;

    setEditing(full);
    setSessionType(full.session_type);
    setSessionDate(full.session_date.slice(0, 10));
    setCalledAt(asTime(full.called_to_order_at));
    setAdjournedAt(asTime(full.adjourned_at));
    setVenue(full.venue ?? "Barangay Hall");
    setAgenda(full.agenda ?? "");
    setMinutes(full.minutes ?? "");
    setStatus(full.status === "Adopted" ? "For Approval" : full.status);
    setAttendees(full.attendees?.length ? full.attendees : [blankAttendee()]);
    setError("");
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
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
      if (editing) await councilApi.updateSession(editing.id, payload);
      else await councilApi.createSession(payload);

      setOpen(false);
      load();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      setError(res?.data?.message ?? "The session could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const adopt = async (row: Session) => {
    try {
      await councilApi.adoptSession(row.id);
      load();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      window.alert(res?.data?.message ?? "The minutes could not be adopted.");
    }
  };

  const setAttendee = (i: number, patch: Partial<Attendee>) =>
    setAttendees((list) => list.map((a, n) => (n === i ? { ...a, ...patch } : a)));

  return {
    user, canAdopt, rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, period, setPeriod, windowLabel, setWindowLabel, years, setYears,
    periodCounts, setPeriodCounts, open, setOpen, editing, setEditing, saving, setSaving,
    error, setError, sessionType, setSessionType, sessionDate, setSessionDate, calledAt,
    setCalledAt, adjournedAt, setAdjournedAt, venue, setVenue, agenda, setAgenda, minutes,
    setMinutes, status, setStatus, attendees, setAttendees, load, changePeriod, startNew,
    startEdit, save, adopt, setAttendee,
  };
}

export type SessionRecordsState = ReturnType<typeof useSessionRecords>;
