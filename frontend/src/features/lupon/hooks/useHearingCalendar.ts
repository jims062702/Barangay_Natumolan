import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { confirmAction } from "../../../shared/lib/confirm";
import { type View, isSittingView, deskForStage, worksDesk } from "../lib/hearings";
import { useAuth } from "../../../shared/auth/AuthContext";
import { luponApi } from "../api";
import type { LuponCase, LuponHearing, KpFormPayload } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The hearing room: the Punong Barangay's sittings, and the two lists of
 * cases the room keeps beside them.
 *
 * A sitting is worked from here — the summons is printed, the sitting is
 * started (which opens its own screen), moved or cancelled — and a case is
 * withdrawn from here too, because the parties are standing in this room
 * when they say so.
 */
/** What a print is waiting to record once the office says the paper came out. */
type AwaitingPrint =
  | { kind: "case"; caseFile: LuponCase; firstAt: string }
  | { kind: "hearing"; hearing: LuponHearing };

export function useHearingCalendar(view: View) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<LuponHearing[]>([]);
  /* The case lists: awaiting a summons, withdrawn, and certified to court. */
  const [cases, setCases] = useState<LuponCase[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();
  /* How many cases still have no notice of hearing and no summons out. */
  const [unprinted, setUnprinted] = useState(0);

  /* What was decided at a sitting, read back. */
  const [resultFor, setResultFor] = useState<LuponHearing | null>(null);

  /*
   * The case behind a row, read-only.
   *
   * The Secretary writes the minutes and has no docket: the case number
   * linked to one and answered 403 to the one officer whose job is to
   * record what happened. It opens here instead.
   */
  const [caseFor, setCaseFor] = useState<LuponCase | null>(null);

  /* The complainant takes the complaint back. */
  const [withdrawFor, setWithdrawFor] = useState<LuponHearing | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  // KP forms — the summons among them.
  const [formsFor, setFormsFor] = useState<LuponHearing | null>(null);
  const [forms, setForms] = useState<KpFormPayload | null>(null);
  /* Papers printed and not yet confirmed — see afterPrint. */
  const [awaitingPrint, setAwaitingPrint] = useState<AwaitingPrint | null>(null);

  const sittings = isSittingView(view);

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);

    const request = sittings
      ? luponApi.hearings({ params: { page, when: view } })
      : view === "for-summons"
        ? luponApi.awaitingSummons({ params: { page } })
        : luponApi.hearingCases({ params: { page, state: view } });

    request
      .then((r) => {
        const data = r.data.data;
        if (sittings) {
          setRows(data.data ?? []);
        } else {
          setCases(data.data ?? []);
        }
        setLastPage(data.last_page ?? 1);
        setTotal(data.total ?? 0);
        /* Work across the whole register, counted by the server — this
           page's rows are only the first twenty of it. */
        setUnprinted(data.unprinted ?? 0);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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

  /**
   * PRINT FIRST, RECORD SECOND (2026-09-29) — as the Clerk's certificates do.
   *
   * Pressing Print used to record the summons as printed, tell both parties
   * and (for a new case) book three sittings BEFORE the print dialog even
   * opened — so a print cancelled at the dialog still read "Printed". Now
   * the papers open and print, and then the office is asked whether they
   * came out; only a yes records anything. A reprint of papers already out
   * asks nothing, because there is nothing left to record.
   */
  const printSummons = async (hearing: LuponHearing) => {
    setAwaitingPrint(hearing.summons_issued ? null : { kind: "hearing", hearing });
    await openForms(hearing);
  };

  /**
   * A case that has been forwarded to this desk: the papers, then the days.
   *
   * THE PAPERS ARE PRINTED FROM THE PLAN — the three sittings printing would
   * book (three Tuesdays with the Punong Barangay for the Secretary, three
   * Thursdays for the Lupon) — and the sittings are booked only once the
   * office says the papers came out. So there is never a sitting on the
   * books that nobody has been told about, nor a "Printed" with no paper.
   *
   * Two papers come out of the one press: the Notice of Hearing for the
   * complainant, the Summons for the respondent.
   */
  const issueSummons = async (caseFile: LuponCase) => {
    /*
     * Already printed: this is a reprint of a paper that exists, so it
     * opens the forms and touches nothing. The calendar was booked by the
     * first press and must not be booked again.
     */
    if (caseFile.papers_printed_at) {
      setAwaitingPrint(null);
      openForms({
        id: caseFile.papers_hearing_id ?? 0,
        hearing_type: caseFile.papers_for ?? "Mediation",
        lupon_case: caseFile,
      } as LuponHearing);
      return;
    }

    try {
      const plan = await luponApi.summonsPlan(caseFile.id);
      const first = (plan.data.data?.hearings ?? [])[0] as { hearing_type: string; scheduled_at: string; status: string } | undefined;
      if (!first) {
        toast("No sitting could be planned for this case.", "error");
        return;
      }
      setAwaitingPrint({ kind: "case", caseFile, firstAt: first.scheduled_at });
      /* The papers are drawn from the sitting they will book — not booked yet. */
      await openForms({ ...first, id: 0, lupon_case: caseFile } as unknown as LuponHearing);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /**
   * The print dialog has closed: did the papers come out?
   *
   * Asked, never assumed — the browser cannot tell a printed page from a
   * cancelled dialog. Yes records it (and, for a new case, books the
   * sittings the papers name); no changes nothing.
   */
  const afterPrint = async () => {
    const pending = awaitingPrint;
    if (!pending) return;

    const printed = await confirmAction({
      title: "Did the papers print correctly?",
      text: pending.kind === "case"
        ? "Confirm only once the notice of hearing and the summons are in your hand. The three sittings are then booked, "
          + "the case is marked Printed, and both parties are told the schedule."
        : "Confirm only once the papers are in your hand. The summons is then marked Printed, and the parties are told the schedule.",
      confirmText: "Yes, it printed",
      cancelText: "No, not printed",
    });

    if (!printed) {
      toast("Nothing was changed. Press Print again when you are ready.", "info");
      return;
    }

    try {
      const saved = pending.kind === "case"
        ? await luponApi.issueSummons(pending.caseFile.id, { expect_first: pending.firstAt })
        : await luponApi.summonsPrinted(pending.hearing.id);
      announceWrite(saved, "Summons printed.");
      setAwaitingPrint(null);
      /* The papers now stand for the sitting that was booked — a reprint from here asks nothing. */
      if (pending.kind === "case") {
        const first = saved.data.data?.hearings?.[0];
        /* Read again: the case now holds the sitting, so its papers are the case's own. */
        if (first) await openForms({ ...first, lupon_case: pending.caseFile } as LuponHearing);
      }
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
      /* The hour moved while it printed: the papers are drawn again for the new one. */
      if (pending.kind === "case" && (err as { response?: { status?: number } }).response?.status === 409) {
        await issueSummons(pending.caseFile);
      }
    }
  };

  /** The forms dialog closed: nothing is waiting on a print any more. */
  const closeForms = () => {
    setFormsFor(null);
    setAwaitingPrint(null);
  };

  /** Is this desk the one that prints for that case? */
  const mayIssue = (caseFile: LuponCase) =>
    worksDesk(user, deskForStage(caseFile.current_stage));

  /**
     * MOVE THE HOUR, NEVER THE DAY.
     *
     * A Tuesday can be asked to hear ten cases, which no arrangement of
     * ninety-minute slots fits between eight and five — so the arithmetic
     * hands out hours past closing and the desk that knows the hall puts
     * them right. The DATE stays: the summons in a party's hand names it,
     * and a system that moved it would tell them one thing and the hall
     * another.
     */
    const setStartTime = async (hearing: LuponHearing) => {
      const at = hearing.scheduled_at.slice(11, 16);
      const picked = window.prompt(
        "What hour should this sitting begin? Same day, 24-hour clock (e.g. 13:15).",
        at,
      );
      if (!picked || picked === at) return;

      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(picked.trim())) {
        toast("Write the hour as HH:MM, for example 13:15.", "error");
        return;
      }

      try {
        const saved = await luponApi.setStartTime(hearing.id, { start_time: picked.trim() });
        announceWrite(saved, "The sitting's hour was changed.");
        load();
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    };

  /** The parties are in the room: the sitting gets its own screen. */
  const startSession = (hearing: LuponHearing) => navigate(`/lupon/hearings/${hearing.id}/session`);

  /*
   * THERE IS NO CANCEL AND NO MOVE.
   *
   * Both changed a day the parties had already been summoned to. The
   * barangay sits on fixed days and gives the parties three of them: a
   * sitting called off is somebody who came to the hall for nothing, and
   * one moved is somebody who stayed away on a date that still stood. If
   * the hall cannot sit, it is recorded as unsettled and the next stands.
   */

  /** The case behind this row, as the hearing room may read it. */
  const openCaseFile = async (caseId?: number | null) => {
    if (!caseId) return;
    setCaseFor(null);
    try {
      const response = await luponApi.hearingCase(caseId);
      setCaseFor(response.data.data);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  /* The reason, kept per case until the withdrawal is recorded. */
  const withdrawDraft = useModalDraft(
    withdrawFor?.lupon_case?.id ? `lupon-withdraw:${withdrawFor.lupon_case.id}` : null,
    withdrawFor !== null,
    { reason: withdrawReason },
    (kept) => setWithdrawReason(kept.reason ?? ""),
    { blank: { reason: "" }, reset: () => setWithdrawReason("") },
  );

  const openWithdraw = (hearing: LuponHearing) => {
    setWithdrawFor(hearing);
    setWithdrawReason("");
  };

  /** The complainant takes it back: the case closes and the calendar clears. */
  const saveWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!withdrawFor?.lupon_case?.id) return;

    if (!(await confirmAction({
      title: "Withdraw this complaint?",
      text: "The case is closed at the Lupon and every sitting still on the calendar is stood down.",
      confirmText: "Yes, withdraw",
      danger: true,
    }))) return;

    try {
      const saved = await luponApi.withdrawCase(withdrawFor.lupon_case.id, { reason: withdrawReason });
      withdrawDraft.clear();
      setWithdrawFor(null);
      announceWrite(saved, "The complaint was withdrawn.");
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
  const awaitingSummons = rows.filter((h) => h.status === "Scheduled" && !h.summons_issued).length;
  const completed = rows.filter((h) => h.status === "Completed").length;
  const cancelled = rows.filter((h) => h.status === "Cancelled").length;

  return {
    pageLoad,
    view, sittings, rows, cases, page, setPage, lastPage, total, loading, load,
    user, issueSummons, mayIssue, unprinted,
    resultFor, setResultFor,
    caseFor, setCaseFor, openCaseFile,
    withdrawFor, setWithdrawFor, withdrawReason, setWithdrawReason, openWithdraw, saveWithdraw, withdrawDraft,
    formsFor, setFormsFor, forms, setForms, openForms, awaitingPrint, afterPrint, closeForms,
    printSummons, startSession, setStartTime,
    scheduled, awaitingSummons, completed, cancelled,
  };
}

export type HearingCalendarState = ReturnType<typeof useHearingCalendar>;
