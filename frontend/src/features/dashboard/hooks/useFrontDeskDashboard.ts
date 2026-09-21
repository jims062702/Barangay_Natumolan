import { useState, useEffect } from "react";
import { lastSeen } from "../../../shared/offline/lastSeen";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import type { Certificate } from "../../../shared/types";

/** One line of the counter's recent work, as the summary sends it. */
export interface RecentCertificate {
  id: number;
  certificate_number: string;
  certificate_type: string;
  status: string;
  resident: string | null;
  created_at: string;
}
import { dashboardApi } from "../api";
import { serviceApi } from "../../service/api";
import { luponApi } from "../../lupon/api";
import type { MainOfficeDashboardProps, ExecutiveSummary } from "../offices/mainOffice/types";

/**
 * The state and handlers of <MainOfficeDashboard>, so its sections can share them.
 */
export function useFrontDeskDashboard({ executive = false }: MainOfficeDashboardProps) {
  const [stats, setStats] = useState<Record<string, number>>({});
  /**
   * The last few certificates, and where each has got to.
   *
   * Certificates rather than service requests: a request for one raises the
   * certificate the moment it is made, so the request list was the same work
   * under an earlier name — and the queue it linked to came off the menu.
   */
  const [recent, setRecent] = useState<RecentCertificate[]>([]);
  const [readyQueue, setReadyQueue] = useState<Certificate[]>([]);
  const [kpCounts, setKpCounts] = useState({ hearings: 0, repudiation: 0 });
  const [exec, setExec] = useState<ExecutiveSummary | null>(null);
  /*
   * What residents come in for, this year. BOTH views show it: the clerk
   * issues these documents all day and should see which ones lead.
   */
  const [requested, setRequested] = useState<{ service_type: string; count: number }[]>([]);

  /* Flipped when the first load SETTLES. The page has two quite different
     shapes depending on who is looking, so each branch waits behind its own. */
  const [ready, setReady] = useState(false);
  /*
   * When the figures were last true.
   *
   * Null while the line is up. Set with no line, where the tiles show the
   * last counts the server gave rather than zeros — five tiles reading 0
   * say the counter is clear, and a clerk who believes that goes home.
   */
  const [countedAt, setCountedAt] = useState<string | null>(null);

  const load = async () => {
    const [summary, pending] = await Promise.all([
      lastSeen<{ quick_stats: Record<string, number>; recent_activity?: { recent_certificates?: RecentCertificate[] } }>(
        "dashboard.summary", () => dashboardApi.summary(),
      ),
      lastSeen<Record<string, number>>("dashboard.pending-items", () => dashboardApi.pendingItems()),
    ]);
    setCountedAt(summary.stale || pending.stale ? summary.at ?? pending.at : null);
    setStats({ ...(summary.data?.quick_stats ?? {}), ...(pending.data ?? {}) });

    /* Its own request, and its own failure: a chart that cannot be drawn
       must not take the rest of the dashboard down with it. */
    void dashboardApi.requestedServices()
      .then((r) => setRequested(r.data.data.services ?? []))
      .catch(() => undefined);

    if (executive) {
      const [certs, deadlines, executive] = await Promise.all([
        // Printed and waiting on the counter for the resident to collect.
        serviceApi.certificates({ params: { status: "Ready to Claim" } }),
        luponApi.deadlines().catch(() => null),
        dashboardApi.executive().catch(() => null),
      ]);
      setReadyQueue(certs.data.data.data ?? []);
      if (deadlines) {
        setKpCounts({
          hearings: (deadlines.data.data.upcoming_hearings ?? []).length,
          repudiation: (deadlines.data.data.repudiation_window ?? []).length,
        });
      }
      setExec(executive?.data.data ?? null);
    } else {
      setRecent(summary.data?.recent_activity?.recent_certificates ?? []);
    }
  };

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executive]);

  // Live updates: a new application appears without a refresh.
  useAutoRefresh(() => load().catch(() => undefined), REFRESH.dashboard);

  return {
    stats, setStats, recent, setRecent, readyQueue, setReadyQueue,
    kpCounts, setKpCounts, exec, setExec, requested, ready, setReady, countedAt,
    setCountedAt, load,
  };
}

export type FrontDeskDashboardState = ReturnType<typeof useFrontDeskDashboard>;
