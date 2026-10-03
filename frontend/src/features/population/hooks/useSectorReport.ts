import { useState, useEffect, useMemo } from "react";
import { useSettledState } from "../../../shared/hooks/useSettledState";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import type { Resident } from "../../../shared/types";
import { SHORT } from "../components/sectors/chartStyle";
import { populationApi } from "../api";
import type { Report, SectorPoint } from "../components/sectors/types";
import { combineLoads, usePageLoad } from "../../../shared/ui/PageLoad";

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
  const [search, setSearch] = useState("");

  const handleSearch = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.staff);

  /* The page's first screen is BOTH answers — the totals and charts, and
     the list under them — so its skeleton waits for the two. */
  const reportLoad = usePageLoad();
  const listLoad = usePageLoad();
  const pageLoad = combineLoads(reportLoad, listLoad);

  /* And within a second when somebody else touches one. */
  usePulse("residents", () => setTick((t) => t + 1));

  useEffect(() => {
    populationApi.sectoralReport()
      .then((r) => {
        setReport(r.data.data ?? null);
        reportLoad.done();
      })
      .catch((error) => reportLoad.fail(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      populationApi.sectorList(encodeURIComponent(selected), {
        params: {
          page,
          search: search.trim() || undefined,
        },
      })
        .then((r) => {
          setResidents(r.data.data.residents.data ?? []);
          setTotal(r.data.data.residents.total ?? 0);
          setLastPage(r.data.data.residents.last_page ?? 1);
        })
        .then(() => listLoad.done(), (error) => listLoad.fail(error))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, page, search, tick]);

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
    pageLoad,
    report, setReport, selected, setSelected, residents, setResidents, total, setTotal,
    lastPage, setLastPage, page, setPage, loading, setLoading, tick, setTick, sectors,
    coverage, grew, sectorData, pickSector, chosen,
    search, setSearch, handleSearch,
  };
}

export type SectorReportState = ReturnType<typeof useSectorReport>;
