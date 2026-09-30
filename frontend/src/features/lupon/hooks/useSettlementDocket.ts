import { useState, useEffect, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { useModalDraft } from "../../../shared/lib/useModalDraft";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { luponApi } from "../api";
import type { LuponSettlement } from "../types";
import { usePageLoad } from "../../../shared/ui/PageLoad";

/**
 * The state and handlers of <Settlements>, so its sections can share them.
 */
export function useSettlementDocket() {
  const [rows, setRows] = useState<LuponSettlement[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  // So the footer can say WHICH rows are on screen, not only the page.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  /* The page's skeleton until the first answer — see PageLoad. */
  const pageLoad = usePageLoad();

  const [viewing, setViewing] = useState<LuponSettlement | null>(null);
  const [notes, setNotes] = useState("");

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi.settlements({ params: { page } })
      .then((r) => {
        setRows(r.data.data.data ?? []);
        setLastPage(r.data.data.last_page ?? 1);
        setTotal(r.data.data.total ?? 0);
      })
      .then(() => pageLoad.done(), (error) => { pageLoad.fail(error); throw error; })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useAutoRefresh(() => load(true), REFRESH.staff);

  /*
   * Somebody else's change, about a second after they make it.
   *
   * The timer above stays as a backstop: if the pulse cannot be
   * reached the page is a few seconds stale rather than frozen.
   */
  usePulse("lupon_cases", () => load(true));

  const open = (settlement: LuponSettlement) => {
    setViewing(settlement);
    setNotes(settlement.compliance_notes ?? "");
  };

  /* The note being written, kept per settlement until it is saved. The note
     on record when it was opened is the version: one saved elsewhere since
     is not overwritten by old typing. */
  const notesDraft = useModalDraft(
    viewing ? `settlement-notes:${viewing.id}` : null,
    viewing !== null,
    { notes },
    (kept) => setNotes(kept.notes ?? ""),
    {
      blank: { notes: viewing?.compliance_notes ?? "" },
      reset: () => setNotes(viewing?.compliance_notes ?? ""),
      version: viewing ? JSON.stringify(viewing.compliance_notes ?? "") : null,
    },
  );

  const run = async (settlement: LuponSettlement, action: string, label: string) => {
    if (
      !(await confirmAction({
        title: `${label} — ${settlement.lupon_case?.case_number ?? "settlement"}?`,
        confirmText: `Yes, ${label.toLowerCase()}`,
        danger: ["repudiate", "mark_not_complied"].includes(action),
      }))
    )
      return;
    try {
      const response = await luponApi.settlementAction(settlement.id, {
        action,
        notes: notes || null,
      });
      notesDraft.clear();
      setViewing(null);
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const saveNotes = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewing) return;
    try {
      // No `action` — this records what has been done about the settlement
      // and never advances the status, so one still inside its repudiation
      // window stays there.
      const saved = await luponApi.settlementAction(viewing.id, {
        notes: notes || null,
      }, { offline: { label: "Settlement notes" } });
      notesDraft.clear();
      setViewing(null);
      announceWrite(saved, "Notes saved.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const inWindow = rows.filter((s) => s.status === "Within Repudiation Period").length;
  /*
   * NO "OVERDUE" COUNT, because there is no due date any more.
   *
   * The register kept a compliance deadline nobody at this barangay set:
   * the terms say when the money is handed over, and the office learns it
   * was not from the complainant coming back — not from a date passing.
   */
  const complied = rows.filter((s) => ["Complied", "Executed"].includes(s.status)).length;

  return {
    pageLoad,
    rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal, loading, setLoading,
    viewing, setViewing, notes, setNotes, load, notesDraft,
    open, run, saveNotes, inWindow, complied,
  };
}

export type SettlementDocketState = ReturnType<typeof useSettlementDocket>;
