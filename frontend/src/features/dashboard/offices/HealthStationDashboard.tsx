import { useEffect, useState } from "react";
import {  FiActivity, FiAlertTriangle, FiHeart, FiSmile , FiPlus } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAutoRefresh, REFRESH } from "../../../shared/hooks/useAutoRefresh";
import { usePulse } from "../../../shared/hooks/usePulse";
import { DashboardBodySkeleton } from "../../../shared/ui/Skeleton";
import Card from "../../../shared/ui/Card";
import StatTile from "../../../shared/ui/StatTile";
import StatusBadge from "../../../shared/ui/StatusBadge";
import PageHeader from "../../../shared/ui/PageHeader";
import RevealGroup from "../../../shared/ui/RevealGroup";
import { dashboardApi } from "../api";
import { healthApi } from "../../health/api";
import type { ImmunizationRecord } from "../../health/types";

interface Coverage {
  total_visits: number;
  total_immunized: number;
  total_prenatal: number;
  immunization_coverage: number;
}

export default function HealthStationDashboard() {
  const [todayVisits, setTodayVisits] = useState(0);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [attention, setAttention] = useState<ImmunizationRecord[]>([]);

  // Live updates: bump `tick` to re-run the fetches below.
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1), REFRESH.dashboard);

  /* And within a second when somebody else touches one. */
  usePulse("health", () => setTick((t) => t + 1));

  /* Flipped when the first fetch SETTLES — success or failure alike. Keyed
     off "is the data still null", a request that fails would leave the
     skeleton pulsing for ever with nothing to read. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.allSettled([
      dashboardApi.summary().then((r) => setTodayVisits(r.data.data.quick_stats?.today_visits ?? 0)),
      healthApi.coverageReport().then((r) => setCoverage(r.data.data)),
      Promise.all([
        healthApi.immunizations({ params: { status: "Missed" } }),
        healthApi.immunizations({ params: { status: "Pending" } }),
      ]).then(([missed, pending]) =>
        setAttention([...(missed.data.data.data ?? []), ...(pending.data.data.data ?? [])])
      ),
    ]).then(() => setReady(true));
  }, [tick]);

  return (
    <div>
      <PageHeader
        title="Health Station Dashboard"
        subtitle="Visits, immunization coverage, and maternal care at a glance"
        actions={
          <Link
            to="/health/visits"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" /> Record a visit
          </Link>
        }
      />

      {!ready ? (
        <DashboardBodySkeleton tiles={4} tileColumns={4} cards={1} cardColumns={1} />
      ) : (
        <>
      <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visits Today" value={todayVisits} icon={FiActivity} />
        <StatTile label="Visits This Year" value={coverage?.total_visits ?? 0} icon={FiHeart} tone="success" />
        <StatTile label="Children Immunized" value={coverage?.total_immunized ?? 0} icon={FiSmile} tone="warning" />
        <StatTile label="Active Pregnancies" value={coverage?.total_prenatal ?? 0} icon={FiAlertTriangle} tone="danger" />
      </RevealGroup>

      <div className="mt-6">
        <Card
          title="Immunizations needing attention (due or missed)"
          action={
            <Link to="/health/immunization" className="text-sm font-medium text-primary hover:underline">
              Open board
            </Link>
          }
        >
          {attention.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              No due or missed vaccines — great coverage!
            </p>
          ) : (
            <ul className="divide-y divide-gray/70">
              {attention.slice(0, 8).map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-dark">
                      {record.child?.first_name} {record.child?.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.vaccine_name} ·{" "}
                      {record.scheduled_date
                        ? new Date(record.scheduled_date).toLocaleDateString("en-PH")
                        : "unscheduled"}
                    </p>
                  </div>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
