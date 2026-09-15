import { useState, useEffect, useMemo } from "react";
import { useSettledState } from "../../../shared/hooks/useSettledState";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import type { Resident } from "../../../shared/types";
import { SHORT } from "../components/sectors/chartStyle";
import { populationApi } from "../api";
import type { Report, SectorPoint } from "../components/sectors/types";

/**
 * The state and handlers of <SectorLists>, so its sections can share them.
 */
export function useSectorReport() {
  /*
   * Compared by VALUE, not by reference.
   *
   * The poll re-fetches the same figures every twenty seconds and hands
   * back a brand-new object each time, so the charts redrew themselves
   * and the numbers counted up again on a page nobody had touched.
   */
  const [report, setReport] = useSettledState<Report | null>(null);
  const [selected, setSelected] = useState("all");
  const [residents, setResidents] = useState<Resident[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.staff);

  /* And within a second when somebody else touches one. */
  usePulse("residents", () => setTick((t) => t + 1));

  useEffect(() => {
    populationApi.sectoralReport()
      .then((r) => setReport(r.data.data ?? null))
      .catch(() => undefined);
  }, [tick]);

  useEffect(() => {
    setLoading(true);
    populationApi.sectorList(encodeURIComponent(selected), { params: { page } })
      .then((r) => {
        setResidents(r.data.data.residents.data ?? []);
        setTotal(r.data.data.residents.total ?? 0);
        setLastPage(r.data.data.residents.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [selected, page, tick]);

  const sectors = report?.sectors ?? [];
  const coverage = report?.coverage ?? [];
  const grew = useMemo(
    () => coverage.reduce((sum, point) => sum + point.joined, 0),
    [coverage]
  );

  /* Already largest-first from the endpoint; this only adds what the axis
   * and the tooltip need. */
  const sectorData = useMemo<SectorPoint[]>(
    () =>
      sectors.map((row) => ({
        ...row,
        short: SHORT[row.sector_type] ?? row.sector_type,
        share: report?.population
          ? Math.round((row.count / report.population) * 100)
          : 0,
      })),
    [sectors, report]
  );

  /* Recharts hands the row back untyped, so the guard is here rather than
   * in the markup. */
  const pickSector = (entry: unknown) => {
    const row = entry as { sector_type?: string } | undefined;
    if (row?.sector_type) {
      setSelected(row.sector_type);
      setPage(1);
    }
  };
  const chosen =
    selected === "all"
      ? "everyone on a list"
      : selected === "untagged"
        ? "residents on no list at all"
        : selected;

  return {
    report, setReport, selected, setSelected, residents, setResidents, total, setTotal,
    lastPage, setLastPage, page, setPage, loading, setLoading, tick, setTick, sectors,
    coverage, grew, sectorData, pickSector, chosen,
  };
}

export type SectorReportState = ReturnType<typeof useSectorReport>;
