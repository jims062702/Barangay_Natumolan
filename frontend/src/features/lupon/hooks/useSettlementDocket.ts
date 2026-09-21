import { useState, useEffect, type FormEvent } from "react";
import { errorMessage } from "../../../shared/lib/api";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { confirmAction } from "../../../shared/lib/confirm";
import { toast } from "../../../shared/lib/toast";
import { announceWrite } from "../../../shared/lib/announceWrite";
import { daysUntil } from "../lib/settlements";
import { luponApi } from "../api";
import type { LuponSettlement } from "../types";

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
  const [dueOnly, setDueOnly] = useState(false);

  const [viewing, setViewing] = useState<LuponSettlement | null>(null);
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");

  /*
   * `silent` is for the background timer.
   *
   * A refresh nobody asked for must not blank the page somebody is
   * reading; a first load or a filter change should still say it is
   * working. Same fetch, and only the announcement differs.
   */
  const load = (silent = false) => {
    if (!silent) setLoading(true);
    luponApi.settlements({ params: { page, due: dueOnly ? 1 : undefined } })
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
  }, [page, dueOnly]);

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
    setDeadline(settlement.compliance_deadline?.slice(0, 10) ?? "");
  };

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
        compliance_deadline: deadline || null,
      });
      setViewing(null);
      toast(response.data.message);
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const saveDeadline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewing) return;
    try {
      // No `action` — this records the terms only and never advances the
      // status, so a settlement still inside its repudiation window stays there.
      const saved = await luponApi.settlementAction(viewing.id, {
        notes: notes || null,
        compliance_deadline: deadline || null,
      }, { offline: { label: "Compliance terms" } });
      setViewing(null);
      announceWrite(saved, "Compliance terms updated.");
      load();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const inWindow = rows.filter((s) => s.status === "Within Repudiation Period").length;
  const overdue = rows.filter(
    (s) =>
      ["Final", "Not Complied"].includes(s.status) &&
      s.compliance_deadline &&
      (daysUntil(s.compliance_deadline) ?? 0) < 0
  ).length;
  const complied = rows.filter((s) => ["Complied", "Executed"].includes(s.status)).length;

  return {
    rows, setRows, page, setPage, lastPage, setLastPage, total, setTotal, loading, setLoading,
    dueOnly, setDueOnly, viewing, setViewing, notes, setNotes, deadline, setDeadline, load,
    open, run, saveDeadline, inWindow, overdue, complied,
  };
}

export type SettlementDocketState = ReturnType<typeof useSettlementDocket>;
