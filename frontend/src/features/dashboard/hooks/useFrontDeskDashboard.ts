import { useState, useEffect } from "react";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import type { ServiceRequest, Certificate, Appointment } from "../../../shared/types";
import { dashboardApi } from "../api";
import { serviceApi } from "../../service/api";
import { luponApi } from "../../lupon/api";
import type { MainOfficeDashboardProps, ExecutiveSummary } from "../offices/mainOffice/types";

/**
 * The state and handlers of <MainOfficeDashboard>, so its sections can share them.
 */
export function useFrontDeskDashboard({ executive = false }: MainOfficeDashboardProps) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<ServiceRequest[]>([]);
  const [readyQueue, setReadyQueue] = useState<Certificate[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [kpCounts, setKpCounts] = useState({ hearings: 0, repudiation: 0 });
  const [exec, setExec] = useState<ExecutiveSummary | null>(null);

  /* Flipped when the first load SETTLES. The page has two quite different
     shapes depending on who is looking, so each branch waits behind its own. */
  const [ready, setReady] = useState(false);

  const load = async () => {
    const [summary, pending] = await Promise.all([
      dashboardApi.summary(),
      dashboardApi.pendingItems(),
    ]);
    setStats({ ...summary.data.data.quick_stats, ...pending.data.data });

    if (executive) {
      const [certs, appts, deadlines, executive] = await Promise.all([
        // Printed and waiting on the counter for the resident to collect.
        serviceApi.certificates({ params: { status: "Ready to Claim" } }),
        serviceApi.appointments({ params: { status: "Scheduled" } }),
        luponApi.deadlines().catch(() => null),
        dashboardApi.executive().catch(() => null),
      ]);
      setReadyQueue(certs.data.data.data ?? []);
      setAppointments(appts.data.data.data ?? []);
      if (deadlines) {
        setKpCounts({
          hearings: (deadlines.data.data.upcoming_hearings ?? []).length,
          repudiation: (deadlines.data.data.repudiation_window ?? []).length,
        });
      }
      setExec(executive?.data.data ?? null);
    } else {
      setRecent(summary.data.data.recent_activity?.recent_requests ?? []);
    }
  };

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executive]);

  // Live updates: new applications/appointments appear without a refresh.
  useAutoRefresh(() => load().catch(() => undefined), REFRESH.dashboard);

  return {
    stats, setStats, recent, setRecent, readyQueue, setReadyQueue, appointments,
    setAppointments, kpCounts, setKpCounts, exec, setExec, ready, setReady, load,
  };
}

export type FrontDeskDashboardState = ReturnType<typeof useFrontDeskDashboard>;
