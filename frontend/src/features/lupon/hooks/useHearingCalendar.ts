import { useState, useEffect, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { toast } from "../../../shared/lib/toast";
import { confirmAction } from "../../../shared/lib/confirm";
import { type View, unserved } from "../lib/hearings";
import { luponApi } from "../api";
import type { LuponHearing, KpFormPayload } from "../types";

/**
 * The state and handlers of <Hearings>, so its sections can share them.
 */
export function useHearingCalendar() {
  // Today is the working view — the desk needs the day it is running.
  const [view, setView] = useState<View>("today");
  const [rows, setRows] = useState<LuponHearing[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Summons / proof of service
  const [summonsFor, setSummonsFor] = useState<LuponHearing | null>(null);
  const [issued, setIssued] = useState(true);
  const [servedDate, setServedDate] = useState("");

  // Outcome + attendance
  const [outcomeFor, setOutcomeFor] = useState<LuponHearing | null>(null);
  const [status, setStatus] = useState("Completed");
  const [complainantPresent, setComplainantPresent] = useState(true);
  const [respondentPresent, setRespondentPresent] = useState(true);
  const [proceedings, setProceedings] = useState("");
  const [outcome, setOutcome] = useState("");

  // Reschedule
  const [resetFor, setResetFor] = useState<LuponHearing | null>(null);
  const [newDateTime, setNewDateTime] = useState("");
  const [reason, setReason] = useState("");

  // KP forms
  const [formsFor, setFormsFor] = useState<LuponHearing | null>(null);
  const [forms, setForms] = useState<KpFormPayload | null>(null);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi.hearings({ params: { page, when: view } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, view]);

  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("lupon_cases", () => load(true));

  const openSummons = (hearing: LuponHearing) => {
    setSummonsFor(hearing);
    setIssued(hearing.summons_issued);
    setServedDate(hearing.summons_served_date?.slice(0, 10) ?? "");
  };

  const saveSummons = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!summonsFor) return;
    try {
      const saved = await luponApi.recordSummons(summonsFor.id, {
        summons_issued: issued,
        summons_served_date: servedDate || null,
      }, { offline: { label: "Summons record" } });
      setSummonsFor(null);
      announceWrite(saved, "Summons record updated.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const openOutcome = (hearing: LuponHearing) => {
    setOutcomeFor(hearing);
    setStatus("Completed");
    setComplainantPresent(hearing.complainant_present ?? true);
    setRespondentPresent(hearing.respondent_present ?? true);
    setProceedings(hearing.proceedings_notes ?? "");
    setOutcome(hearing.outcome ?? "");
  };

  const saveOutcome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!outcomeFor) return;
    if (!(await confirmAction({ title: "Record this hearing outcome?", confirmText: "Yes, record" }))) return;
    try {
      const saved = await luponApi.recordHearingOutcome(outcomeFor.id, {
        status,
        complainant_present: complainantPresent,
        respondent_present: respondentPresent,
        proceedings_notes: proceedings || null,
        outcome: outcome || null,
      }, { offline: { label: "Hearing outcome" } });
      setOutcomeFor(null);
      announceWrite(saved, "Hearing outcome recorded.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /**
   * The parties agreed at the table, so the case is over.
   *
   * Not an outcome among others: this CLOSES the case to the Lupon and
   * stands down every sitting still on the calendar. It is deliberately a
   * separate action rather than a word typed into the outcome box, because
   * "Settlement reached" written there closed nothing and left three more
   * Tuesdays on the calendar nobody would attend.
   *
   * NOT QUEUED OFFLINE. Closing a case stands other sittings down and is
   * read by the Lupon straight away; a closure that reaches the server
   * hours later is a hearing somebody may have held in the meantime.
   */
  const settleCase = async () => {
    if (!outcomeFor) return;

    if (!proceedings.trim()) {
      toast("Write the minutes of this sitting before closing the case.", "error");

      return;
    }

    if (!(await confirmAction({
      title: "Settle and close this case?",
      text: "The remaining sittings are stood down and the Lupon has nothing further to work.",
      confirmText: "Yes, settle",
    }))) return;

    try {
      const saved = await luponApi.settleAtHearing(outcomeFor.id, {
        proceedings_notes: proceedings,
        outcome: outcome || "Settlement Reached",
        complainant_present: complainantPresent,
        respondent_present: respondentPresent,
      });
      setOutcomeFor(null);
      announceWrite(saved, "Case settled and closed.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const openReset = (hearing: LuponHearing) => {
    setResetFor(hearing);
    setNewDateTime("");
    setReason("");
  };

  const saveReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetFor) return;
    if (
      !(await confirmAction({
        title: "Reset this hearing?",
        text: "Both parties will be notified of the new date.",
        confirmText: "Yes, reschedule",
      }))
    )
      return;
    try {
      const saved = await luponApi.rescheduleHearing(resetFor.id, {
        scheduled_at: newDateTime.replace("T", " ") + ":00",
        reason: reason || null,
      }, {
        offline: {
          label: "Reschedule hearing",
          /* "Both parties were notified" is only true once the server has
             it — the notification is sent there. Said honestly here. */
          message: "Saved on this device. Both parties will be notified when the connection returns.",
        },
      });
      setResetFor(null);
      announceWrite(saved, "Hearing rescheduled — both parties were notified.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const openForms = async (hearing: LuponHearing) => {
    setFormsFor(hearing);
    setForms(null);
    try {
      const response = await luponApi.kpForms(hearing.lupon_case?.id);
      setForms(response.data.data);
    } catch (err) {
      toast(errorMessage(err), "error");
      setFormsFor(null);
    }
  };

  const scheduled = rows.filter((h) => h.status === "Scheduled").length;
  const awaitingService = rows.filter(unserved).length;
  const noShows = rows.filter((h) => h.status === "No Show").length;
  const completed = rows.filter((h) => h.status === "Completed").length;
  const cancelled = rows.filter((h) => h.status === "Cancelled").length;

  return {
    view, setView, rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal,
    loading, setLoading, summonsFor, setSummonsFor, issued, setIssued, servedDate,
    setServedDate, outcomeFor, setOutcomeFor, status, setStatus, complainantPresent,
    setComplainantPresent, respondentPresent, setRespondentPresent, proceedings, settleCase,
    setProceedings, outcome, setOutcome, resetFor, setResetFor, newDateTime, setNewDateTime,
    reason, setReason, formsFor, setFormsFor, forms, setForms, load, openSummons, saveSummons,
    openOutcome, saveOutcome, openReset, saveReset, openForms, scheduled, awaitingService,
    noShows, completed, cancelled,
  };
}

export type HearingCalendarState = ReturnType<typeof useHearingCalendar>;
