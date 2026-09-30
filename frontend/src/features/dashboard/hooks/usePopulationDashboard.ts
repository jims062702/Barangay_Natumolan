import { useState, useEffect } from "react";
import { usePageLoad } from "../../../shared/ui/PageLoad";
import { useSettledState } from "../../../shared/hooks/useSettledState";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { populationApi } from "../../population/api";
import type { Analytics } from "../offices/population/types";

/**
 * The state and handlers of <PopulationOfficeDashboard>, so its sections can share them.
 */
export function usePopulationDashboard() {
  /*
   * Compared by VALUE, not by reference.
   *
   * The poll re-fetches the same figures every twenty seconds and hands
   * back a brand-new object each time, so the charts redrew themselves
   * and the numbers counted up again on a page nobody had touched.
   */
  const [analytics, setAnalytics] = useSettledState<Analytics | null>(null);
  /*
   * Separate from `analytics === null`, because a refresh must not blank the
   * page it is refreshing. The skeleton is for the FIRST load only; after
   * that the numbers on screen stay put until the new ones arrive.
   */
  const pageLoad = usePageLoad();

  // Live updates: bump `tick` to re-run the fetch below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("residents", () => setTick((t) => t + 1));

  useEffect(() => {
    populationApi.analytics()
      .then((r) => {
        setAnalytics(r.data.data);
        pageLoad.done();
      })
      .catch((error) => pageLoad.fail(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const ageData = Object.entries(analytics?.population_by_age_group ?? {}).map(([label, count]) => ({
    label: label.replace(" years", ""),
    count,
  }));
  const purokData = (analytics?.population_by_zone ?? []).map((z) => ({
    label: z.zone_purok ?? "Unassigned",
    count: z.count,
  }));
  const genderData = Object.entries(analytics?.population_by_gender ?? {})
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);
  const events = analytics?.events_this_year ?? [];
  const register = analytics?.register_by_month ?? [];
  const addedThisYear = register.reduce((sum, point) => sum + point.added, 0);

  // Standard dependency bands: 0-14 and 65+ are carried by 15-64.
  const dependencyData = analytics
    ? [
        { label: "0-14", count: analytics.dependency.young_dependents },
        { label: "15-64", count: analytics.dependency.working_age },
        { label: "65+", count: analytics.dependency.old_dependents },
      ]
    : [];
  const sectorData = (analytics?.sector_counts ?? []).filter((s) => s.count > 0);

  return {
    analytics, setAnalytics, pageLoad, tick, setTick, ageData, purokData,
    genderData, events, register, addedThisYear, dependencyData, sectorData,
  };
}

export type PopulationDashboardState = ReturnType<typeof usePopulationDashboard>;
