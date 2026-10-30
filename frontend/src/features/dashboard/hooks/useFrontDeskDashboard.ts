import { useState, useEffect } from "react";
import { usePageLoad } from "../../../shared/ui/PageLoad";
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
import { luponApi } from "../../lupon/api";
import type { MainOfficeDashboardProps } from "../offices/mainOffice/types";
import type { LuponHearing } from "../../lupon/types";

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
  /*
   * The Punong Barangay's own sittings: the ones today, and the ones ahead.
   *
   * Their dashboard used to open on the certificates residents ask for and
   * the announcements the barangay published — neither of which they do.
   * What they do is sit at the table, so what it opens on is the table.
   *
   * The server already keeps them to Mediation for this reader, so these
   * are the Tuesdays and never the Lupon's Thursdays.
   */
  const [todaySittings, setTodaySittings] = useState<LuponHearing[]>([]);
  const [nextSittings, setNextSittings] = useState<LuponHearing[]>([]);
  /*
   * No `exec` any more. It carried the announcements and the documents
   * awaiting a signature for the Punong Barangay's dashboard; that page now
   * opens on the sittings they preside over, so the request was one made on
   * every refresh whose answer was thrown away.
   */
  /*
   * What residents come in for, this year. BOTH views show it: the clerk
   * issues these documents all day and should see which ones lead.
   */
  const [requested, setRequested] = useState<{ service_type: string; count: number }[]>([]);

  /* The first load: the page's skeleton until it answers — see PageLoad. The
     page has two quite different shapes depending on who is looking, and
     the skeleton is drawn for whichever one this account sees. */
  const pageLoad = usePageLoad();
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
      const [deadlines, today, ahead] = await Promise.all([
        luponApi.deadlines().catch(() => null),
        /* Each on its own failure: a dashboard is five questions, and one
           of them going unanswered must not blank the other four. */
        luponApi.hearings({ params: { when: "today" } }).catch(() => null),
        luponApi.hearings({ params: { when: "upcoming" } }).catch(() => null),
      ]);
      setTodaySittings(today?.data.data.data ?? []);
      setNextSittings((ahead?.data.data.data ?? []).slice(0, 5));
      if (deadlines) {
        setKpCounts({
          hearings: (deadlines.data.data.upcoming_hearings ?? []).length,
          repudiation: (deadlines.data.data.repudiation_window ?? []).length,
        });
      }
    } else {
      setRecent(summary.data?.recent_activity?.recent_certificates ?? []);
    }
  };

  const firstLoad = () => {
    load()
      .then(() => pageLoad.done())
      .catch((error) => pageLoad.fail(error));
  };

  useEffect(() => {
    firstLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executive]);

  // Live updates: a new application appears without a refresh.
  useAutoRefresh(() => load().catch(() => undefined), REFRESH.dashboard);

  return {
    stats, setStats, recent, setRecent, readyQueue, setReadyQueue,
    kpCounts, setKpCounts, requested, pageLoad, firstLoad, countedAt,
    todaySittings, nextSittings,
    setCountedAt, load,
  };
}

export type FrontDeskDashboardState = ReturnType<typeof useFrontDeskDashboard>;
